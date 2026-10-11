const net = require('net');
const { performance } = require('perf_hooks');
const semver = require('semver');

const GENESIS = '9c89283ba0f3227f6c03b70216b9f665f0118d5e0fa729cedf4fb34d6a34f463';

function parseServer(endpoint) {
  // settings_get returns [host, port] pairs; settings_set accepts host:port strings.
  if (Array.isArray(endpoint) && endpoint.length === 2) endpoint = endpoint.join(':');
  const match = typeof endpoint === 'string' && endpoint.match(/^([a-z0-9.-]+):(\d+)$/i);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 65535) throw new Error('Invalid hub address.');
  return { endpoint, host: match[1], port: Number(match[2]) };
}

function probeHub(endpoint, timeout = 4000) {
  const server = parseServer(endpoint);
  return new Promise(resolve => {
    const started = performance.now();
    const socket = net.createConnection({ host: server.host, port: server.port });
    let pending = '';
    let bytes = 0;
    let expected = 1;
    let done = false;
    const finish = error => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.destroy();
      resolve({ ...server, latency: error ? null : Math.max(1, Math.round(performance.now() - started)), error });
    };
    const timer = setTimeout(() => finish('Timed out'), timeout);
    const send = (id, method, params) => socket.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    socket.setEncoding('utf8');
    socket.on('connect', () => send(1, 'server.version', ['LBRY Desktop NG', '0.113.0']));
    socket.on('error', () => finish('Unreachable'));
    socket.on('close', () => finish('Connection closed'));
    socket.on('data', chunk => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 65536) return finish('Invalid response');
      pending += chunk;
      while (pending.includes('\n')) {
        if (done) break;
        const end = pending.indexOf('\n');
        const line = pending.slice(0, end);
        pending = pending.slice(end + 1);
        try {
          const reply = JSON.parse(line);
          if (!reply || reply.id !== expected || reply.error) return finish('Invalid response');
          if (expected === 1) {
            const version = Array.isArray(reply.result) && reply.result[1];
            if (!semver.valid(version) || semver.lt(version, '0.65.0')) return finish('Incompatible protocol');
            expected = 2;
            send(2, 'server.features', []);
          } else {
            if (!reply.result || reply.result.genesis_hash !== GENESIS) return finish('Wrong network');
            finish(null);
          }
        } catch (_) { finish('Invalid response') }
      }
    });
  });
}

async function probeHubs(endpoints, probe = probeHub) {
  const queue = [...new Set(endpoints.map(endpoint => parseServer(endpoint).endpoint))];
  if (queue.length > 64) throw new Error('Too many configured hubs to check.');
  queue.forEach(parseServer);
  const results = [];
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length) results.push(await probe(queue.shift()));
  }));
  return results.sort((a, b) => (a.latency === null ? Infinity : a.latency) -
    (b.latency === null ? Infinity : b.latency) || a.endpoint.localeCompare(b.endpoint));
}

class HubSelection {
  constructor({ rpc, restart, hasCustomServers, probe = probeHub, connectionTimeout = 60000 }) {
    Object.assign(this, { rpc, restart, hasCustomServers, probe, connectionTimeout });
    this.offered = new Set();
  }

  async scan() {
    if (this.selecting) throw new Error('A hub change is already in progress.');
    if (!this.scanning) {
      this.scanning = (async () => {
        const settings = await this.rpc('settings_get');
        const servers = await probeHubs(settings.lbryum_servers, this.probe);
        this.offered = new Set(servers.filter(server => !server.error).map(server => server.endpoint));
        return { servers };
      })();
    }
    try { return await this.scanning } finally { this.scanning = null }
  }

  async waitForWallet() {
    const deadline = Date.now() + this.connectionTimeout;
    do {
      const status = await this.rpc('status');
      if (status.wallet && status.wallet.available_servers > 0) return;
      await new Promise(resolve => setTimeout(resolve, 250));
    } while (Date.now() < deadline);
    throw new Error('The wallet could not connect to the selected hub.');
  }

  async select(endpoint) {
    if (this.selecting || this.scanning) throw new Error('Wait for the current hub check to finish.');
    if (endpoint !== null && !this.offered.has(endpoint)) throw new Error('Check the hubs before choosing one.');
    this.selecting = true;
    try {
      if (endpoint !== null && (await this.probe(endpoint)).error) throw new Error('That hub is no longer responding. Please check again.');
      const previous = (await this.rpc('settings_get')).lbryum_servers.map(server => parseServer(server).endpoint);
      const hadCustom = this.hasCustomServers();
      if (endpoint === null && !hadCustom) return null;
      try {
        if (endpoint === null) await this.rpc('settings_clear', { key: 'lbryum_servers' });
        else await this.rpc('settings_set', { key: 'lbryum_servers', value: [endpoint] });
        // A full owned-SDK restart also bounds a stalled wallet startup. Do not
        // overlap wallet_reconnect calls, which may still be syncing after an HTTP timeout.
        await this.restart();
        await this.waitForWallet();
      } catch (error) {
        try {
          if (hadCustom) await this.rpc('settings_set', { key: 'lbryum_servers', value: previous });
          else await this.rpc('settings_clear', { key: 'lbryum_servers' });
          await this.restart();
          await this.waitForWallet();
        } catch (_) {
          throw new Error('The hub change failed and the previous connection could not be restored. Restart the app and check wallet server settings.');
        }
        throw new Error('The hub change failed. Your previous connection has been restored.');
      }
      return endpoint === null ? null : parseServer(endpoint);
    } finally { this.selecting = false }
  }
}

module.exports = { GENESIS, parseServer, probeHub, probeHubs, HubSelection };
