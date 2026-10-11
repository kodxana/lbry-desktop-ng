/* eslint no-console:0 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execFile } = require('child_process');
const { artifactFor, verifiedBytes } = require('../build/sdkArtifact.cjs');
const candidate = require('../build/sdk-candidate.json');
const { daemonFlags, daemonEnvironment, assertPortsAvailable } = require('./testProfile.cjs');

class Daemon {
  constructor(profile, binary, headers) {
    this.profile = profile;
    this.binary = binary;
    this.headers = headers;
    this.handlers = [];
    this.subprocess = null;
    this.ready = false;
  }

  rpc(method, params = {}) {
    return new Promise((resolve, reject) => {
      const request = http.request({
        host: '127.0.0.1',
        port: this.profile.ports.apiPort,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, response => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { body += chunk });
        response.on('error', reject);
        response.on('end', () => {
          try {
            const reply = JSON.parse(body);
            if (reply.error) throw new Error(JSON.stringify(reply.error));
            resolve(reply.result);
          } catch (error) { reject(error) }
        });
      });
      request.setTimeout(3000, () => request.destroy(new Error('SDK request timed out.')));
      request.on('error', reject);
      request.end(JSON.stringify({ method, params }));
    });
  }

  async verifyOwner() {
    if (!this.subprocess) throw new Error('The owned SDK process has exited.');
    const settings = await this.rpc('settings_get');
    for (const [setting, directory] of [['data_dir', 'data'], ['wallet_dir', 'wallet'], ['download_dir', 'downloads']]) {
      if (path.resolve(settings[setting]) !== this.profile[directory]) {
        throw new Error('SDK profile mismatch: ' + setting);
      }
    }
    const version = await this.rpc('version');
    if (version.lbrynet_version !== candidate.version) throw new Error('SDK version mismatch.');
  }

  async launch() {
    verifiedBytes(this.binary, artifactFor().sha256);
    await assertPortsAvailable(this.profile.ports);
    const flags = daemonFlags(this.profile);
    if (this.headers) flags.push('--initial-headers=' + this.headers);
    this.log = fs.createWriteStream(path.join(this.profile.logs, 'daemon-console.log'), { flags: 'a' });
    const child = spawn(this.binary, flags, {
      cwd: this.profile.root, env: daemonEnvironment(this.profile), windowsHide: true,
    });
    this.subprocess = child;
    child.stdout.pipe(this.log, { end: false });
    child.stderr.pipe(this.log, { end: false });
    let spawnError;
    child.on('error', error => { spawnError = error });
    this.exited = new Promise(resolve => child.once('close', (code, signal) => {
      this.subprocess = null;
      this.ready = false;
      this.log.end(() => {
        resolve({ code, signal });
        this.handlers.forEach(handler => handler());
      });
    }));
    try {
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        if (this.shutdown) throw new Error('SDK startup was cancelled.');
        if (spawnError) throw spawnError;
        if (!this.subprocess) throw new Error('SDK exited during startup; see ' + this.profile.logs);
        try {
          await this.verifyOwner();
          this.ready = true;
          return;
        } catch (error) {
          if (!['ECONNREFUSED', 'ECONNRESET'].includes(error.code)) throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      throw new Error('SDK startup timed out; see ' + this.profile.logs);
    } catch (error) {
      await this.quit();
      throw error;
    }
  }

  quit() {
    if (!this.shutdown) this.shutdown = this.stopOwnedProcess();
    return this.shutdown;
  }

  async quitForUpdate() {
    await this.quit();
    const result = await this.exited;
    if (!result || result.code !== 0 || result.signal) {
      throw new Error('SDK did not exit cleanly. The update was not installed; check the SDK logs before retrying.');
    }
  }

  async stopOwnedProcess() {
    const child = this.subprocess;
    if (!child) return;
    try {
      // Never send stop to an SDK that merely happens to answer on the test port.
      await this.verifyOwner();
      await this.rpc('stop');
    } catch (error) {
      console.error('SDK stop request failed: ' + error.message);
    }
    let timer;
    const stopped = await Promise.race([
      this.exited.then(() => true),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), 30000) }),
    ]);
    clearTimeout(timer);
    if (!stopped && this.subprocess === child) {
      console.error('SDK did not exit within 30 seconds; terminating owned process ' + child.pid);
      if (process.platform === 'win32') {
        await new Promise((resolve, reject) => execFile('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'],
          { windowsHide: true }, error => error ? reject(error) : resolve()));
      } else child.kill('SIGKILL');
      await this.exited;
    }
  }

  on(event, handler) {
    if (event === 'exit') this.handlers.push(handler);
  }
}

module.exports = Daemon;
