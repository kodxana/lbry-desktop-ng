const assert = require('assert').strict;
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawnSync } = require('child_process');
const WebSocket = require('ws');
const { GENESIS } = require('../electron/hubServers.cjs');

function assertHostedWindows() {
  assert(
    process.platform === 'win32' &&
      process.env.GITHUB_ACTIONS === 'true' &&
      process.env.RUNNER_ENVIRONMENT === 'github-hosted',
    'Native installer tests run only on disposable GitHub-hosted Windows runners'
  );
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, message, timeout = 90000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await delay(250);
  }
  throw new Error(message);
}

function request(port, pathname, payload) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method: payload ? 'POST' : 'GET' }, (res) => {
      let body = '';
      res.on('data', (part) => (body += part));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.setTimeout(3000, () => req.destroy(new Error('Local fixture request timed out')));
    req.on('error', reject);
    req.end(payload && JSON.stringify(payload));
  });
}

async function connectRuntime(port, main = false) {
  const page = await until(async () => {
    try {
      return (await request(port, '/json/list')).find((item) =>
        main ? item.type === 'node' : item.type === 'page' && item.url.includes('index.html')
      );
    } catch (_) {
      return false;
    }
  }, 'Installed application did not expose its test ' + (main ? 'main process' : 'renderer'));
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  let next = 0;
  const pending = new Map();
  socket.on('message', (bytes) => {
    const message = JSON.parse(bytes);
    const waiting = pending.get(message.id);
    if (!waiting) return;
    clearTimeout(waiting.timer);
    pending.delete(message.id);
    message.error ? waiting.reject(new Error(message.error.message)) : waiting.resolve(message.result);
  });
  socket.on('close', () => {
    for (const waiting of pending.values()) {
      clearTimeout(waiting.timer);
      waiting.reject(new Error('Test runtime closed'));
    }
    pending.clear();
  });
  return {
    close: () => socket.close(),
    evaluate: async (expression) => {
      const result = await new Promise((resolve, reject) => {
        const id = ++next;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error('Runtime evaluation timed out'));
        }, 10000);
        pending.set(id, { resolve, reject, timer });
        socket.send(
          JSON.stringify({
            id,
            method: 'Runtime.evaluate',
            params: { expression, returnByValue: true, awaitPromise: true },
          })
        );
      });
      assert(
        !result.exceptionDetails,
        'Installed runtime evaluation failed: ' + JSON.stringify(result.exceptionDetails)
      );
      return result.result.value;
    },
  };
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

async function hubFixture(profile) {
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    let buffer = '';
    socket.on('data', (part) => {
      buffer += part;
      while (buffer.includes('\n')) {
        const end = buffer.indexOf('\n');
        const call = JSON.parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        const replies = {
          'server.version': ['installed-upgrade-fixture', '0.113.0'],
          'server.features': { genesis_hash: GENESIS, protocol_min: '0.113.0', protocol_max: '0.113.0' },
          'server.peers.subscribe': [],
          'server.ping': null,
          'blockchain.headers.subscribe': { height: 0, hex: '' },
          'blockchain.block.headers': { count: 0, hex: '' },
          'blockchain.address.subscribe': (call.params || []).map(() => null),
          'blockchain.address.unsubscribe': true,
        };
        const reply = Object.hasOwn(replies, call.method)
          ? { result: replies[call.method] }
          : { error: { code: -32601, message: 'Fixture method unavailable' } };
        socket.write(JSON.stringify({ jsonrpc: '2.0', id: call.id, ...reply }) + '\n');
      }
    });
  });
  const port = await listen(server);
  fs.writeFileSync(
    profile.config,
    JSON.stringify({
      blockchain_name: 'lbrycrd_regtest',
      lbryum_servers: ['127.0.0.1:' + port],
      components_to_skip: [
        'blob_manager',
        'wallet_server_payments',
        'dht',
        'hash_announcer',
        'file_manager',
        'disk_space',
        'background_downloader',
        'peer_protocol_server',
        'upnp',
        'exchange_rate_manager',
        'tracker_announcer_component',
        'libtorrent_component',
      ],
    })
  );
  fs.writeFileSync(path.join(profile.root, 'hub-setup-complete.json'), '{"version":1}\n');
  return () => {
    for (const socket of sockets) socket.destroy();
    server.close();
  };
}

function powershell(script, env = {}) {
  assertHostedWindows();
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
    env: { ...process.env, ...env },
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function applicationProcesses(executable) {
  const value = powershell(
    "@(Get-CimInstance Win32_Process -Filter \"Name='LBRY Desktop NG.exe'\" | Where-Object { $_.ExecutablePath -eq $env:LBRY_UPGRADE_EXE -and $_.CommandLine -notmatch '--type=' } | Select-Object ProcessId,CommandLine) | ConvertTo-Json -Compress",
    { LBRY_UPGRADE_EXE: executable }
  );
  return value ? [].concat(JSON.parse(value)) : [];
}

function closeApplication(executable, pid) {
  assert(
    applicationProcesses(executable).some((p) => p.ProcessId === pid),
    'Only close the observed test application'
  );
  powershell(
    "$p = Get-Process -Id $env:LBRY_UPGRADE_PID -ErrorAction Stop; if (-not $p.CloseMainWindow()) { throw 'Test window did not accept close' }",
    { LBRY_UPGRADE_PID: String(pid) }
  );
}

module.exports = {
  assertHostedWindows,
  delay,
  until,
  request,
  connectRenderer: (port) => connectRuntime(port),
  connectMain: (port) => connectRuntime(port, true),
  listen,
  hubFixture,
  powershell,
  applicationProcesses,
  closeApplication,
};
