/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const dgram = require('dgram');
const crypto = require('crypto');
const Daemon = require('../electron/Daemon.cjs');
const { HubSelection, parseServer } = require('../electron/hubServers.cjs');
const yaml = require('js-yaml');
const { createProfile, daemonEnvironment, assertPortsAvailable } = require('../electron/testProfile.cjs');
const { stageBinary, artifactFor } = require('./sdkArtifact.cjs');

async function main() {
  const runs = path.resolve(__dirname, '../dist/isolation-tests');
  fs.mkdirSync(runs, { recursive: true });
  const root = fs.mkdtempSync(path.join(runs, 'profile ł '));
  const profile = createProfile(root);
  const binary = path.resolve(__dirname, '../static/daemon/lbrynet' + (process.platform === 'win32' ? '.exe' : ''));
  assert.throws(() => createProfile('relative'), /absolute/);
  const occupiedDirectory = path.join(root, 'unrelated');
  fs.mkdirSync(occupiedDirectory);
  fs.writeFileSync(path.join(occupiedDirectory, 'keep.txt'), 'existing data');
  assert.throws(() => createProfile(occupiedDirectory), /empty directory/);
  assert.deepEqual(createProfile(root), profile);
  const env = daemonEnvironment(profile);
  assert.equal(env.USERPROFILE, profile.home);
  assert.equal(env.APPDATA, path.join(profile.home, 'AppData/Roaming'));
  assert(!Object.keys(env).some(key => /^LBRY_/i.test(key)));
  console.log('PASS: profile ownership, Unicode paths and child environment');

  const source = path.join(root, 'candidate');
  const destination = path.join(root, 'cached');
  fs.writeFileSync(source, 'new candidate');
  fs.writeFileSync(destination, 'previous candidate');
  assert.throws(() => stageBinary(source, destination, '0'.repeat(64)), /SHA-256 mismatch/);
  assert.equal(fs.readFileSync(destination, 'utf8'), 'previous candidate');
  const expected = crypto.createHash('sha256').update('new candidate').digest('hex');
  stageBinary(source, destination, expected);
  assert.equal(fs.readFileSync(destination, 'utf8'), 'new candidate');
  assert.throws(() => artifactFor('win32', 'arm64'), /x64 only/);
  console.log('PASS: corrupt SDK preserves cache; valid replacement and architecture checks');

  let unrelatedRequests = 0;
  const unrelated = http.createServer((request, response) => {
    unrelatedRequests++;
    response.end('{}');
  });
  await new Promise(resolve => unrelated.listen(0, '127.0.0.1', resolve));
  try {
    const conflict = { ...profile, ports: { apiPort: unrelated.address().port, streamingPort: 0, peerPort: 0 } };
    const daemon = new Daemon(conflict, binary);
    await assert.rejects(daemon.launch(), /port is unavailable/);
    await daemon.quit();
    assert.equal(daemon.subprocess, null);
    assert.equal(unrelatedRequests, 0);
  } finally { await new Promise(resolve => unrelated.close(resolve)) }
  const udp = dgram.createSocket('udp4');
  await new Promise(resolve => udp.bind(0, '0.0.0.0', resolve));
  try {
    await assert.rejects(assertPortsAvailable({ apiPort: 0, streamingPort: 0, peerPort: udp.address().port }),
      /port is unavailable/);
  } finally { udp.close() }
  console.log('PASS: occupied TCP/UDP ports refuse startup without contacting the existing service');

  const sockets = new Set();
  const unexpected = new Set();
  const hub = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    let buffer = '';
    socket.on('data', chunk => {
      buffer += chunk.toString();
      while (buffer.includes('\n')) {
        const end = buffer.indexOf('\n');
        const request = JSON.parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        const responses = {
          'server.version': ['desktop-isolation-test', '0.113.0'],
          'server.features': {},
          'server.peers.subscribe': [],
          'server.ping': null,
          'blockchain.headers.subscribe': { height: 0, hex: '' },
          'blockchain.block.headers': { count: 0, hex: '' },
          'blockchain.address.subscribe': (request.params || []).map(() => null),
          'blockchain.address.unsubscribe': true,
        };
        const reply = { jsonrpc: '2.0', id: request.id };
        if (Object.prototype.hasOwnProperty.call(responses, request.method)) reply.result = responses[request.method];
        else {
          unexpected.add(request.method);
          reply.error = { code: -32601, message: 'Unexpected test Hub method' };
        }
        socket.write(JSON.stringify(reply) + '\n');
      }
    });
  });
  await new Promise(resolve => hub.listen(0, '127.0.0.1', resolve));
  fs.writeFileSync(profile.config, JSON.stringify({
    blockchain_name: 'lbrycrd_regtest',
    lbryum_servers: ['127.0.0.1:' + hub.address().port],
    components_to_skip: ['blob_manager', 'wallet_server_payments', 'dht', 'hash_announcer',
      'file_manager', 'disk_space', 'background_downloader', 'peer_protocol_server', 'upnp',
      'exchange_rate_manager', 'tracker_announcer_component', 'libtorrent_component'],
  }));
  let initialAddresses;
  async function waitForHistory(daemon) {
    const deadline = Date.now() + 60000;
    while (true) {
      const status = await daemon.rpc('status');
      const history = status.wallet && status.wallet.history_sync;
      if (status.is_running && history && history.state === 'complete') {
        assert.deepEqual(history, {
          state: 'complete',
          entries_completed: 0,
          entries_total: 0,
          pending_operations: 0,
          connected: true,
        });
        return;
      }
      assert(Date.now() < deadline, 'Wallet history did not complete: ' + JSON.stringify(history));
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  try {
    const originalConfig = fs.readFileSync(profile.config);
    const setupDaemon = new Daemon(profile, binary, path.join(root, 'headers-must-not-be-read'));
    try {
      await setupDaemon.launch({ settingsOnly: true });
      const status = await setupDaemon.rpc('status');
      assert.deepEqual(status.startup_status, {});
      assert(!status.wallet);
      assert.equal(fs.readdirSync(profile.wallet).length, 0, 'Setup must not create a wallet or headers');
      assert.equal(sockets.size, 0, 'Setup must not contact the wallet hub');
      assert.deepEqual(fs.readFileSync(profile.config), originalConfig, 'Setup flags must not be persisted');
      assert((await setupDaemon.rpc('settings_get')).lbryum_servers.length > 0);
      await setupDaemon.quitForUpdate();
      console.log('PASS: real SDK settings-only startup exposes hubs without opening a wallet, reading headers or contacting a hub');
    } finally { await setupDaemon.quit() }
    for (let run = 0; run < 2; run++) {
      const daemon = new Daemon(profile, binary);
      try {
        await daemon.launch();
        await waitForHistory(daemon);
        assert.equal((await daemon.rpc('wallet_balance')).total, '0.0');
        const addresses = (await daemon.rpc('address_list')).items.map(item => item.address).sort();
        assert(addresses.length > 0);
        if (run === 0) initialAddresses = addresses;
        else assert.deepEqual(addresses, initialAddresses);
        await daemon.quitForUpdate();
      } finally { await daemon.quit() }
      assert.equal((await daemon.exited).code, 0);
    }

    await require('./testWalletEncryption.cjs')(profile, binary, waitForHistory, initialAddresses);

    // Simulate a hub that stops responding after the setup probe succeeds.
    const stalled = net.createServer(socket => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      socket.on('error', () => {});
    });
    await new Promise(resolve => stalled.listen(0, '127.0.0.1', resolve));
    const stalledEndpoint = '127.0.0.1:' + stalled.address().port;
    const workingEndpoint = '127.0.0.1:' + hub.address().port;
    const config = yaml.load(fs.readFileSync(profile.config, 'utf8'));
    config.lbryum_servers = [stalledEndpoint];
    fs.writeFileSync(profile.config, yaml.dump(config));
    let daemon = new Daemon(profile, binary);
    const selection = new HubSelection({
      rpc: (method, params) => daemon.rpc(method, params),
      hasCustomServers: () => true,
      probe: async endpoint => ({ ...parseServer(endpoint), error: null, latency: 1 }),
      restart: async settingsOnly => {
        await daemon.quitForUpdate();
        daemon = new Daemon(profile, binary);
        await daemon.launch({ settingsOnly });
      },
    });
    try {
      await daemon.launch({ settingsOnly: true });
      await selection.scan();
      await selection.select(stalledEndpoint);
      assert.equal(selection.settingsOnly, false, 'Start must return before a stalled wallet finishes syncing');
      await selection.prepare();
      assert.deepEqual((await daemon.rpc('status')).startup_status, {});
      await selection.scan();
      await selection.checkCustom(workingEndpoint);
      await selection.select(workingEndpoint);
      await waitForHistory(daemon);
      assert.deepEqual((await daemon.rpc('settings_get')).lbryum_servers,
        [['127.0.0.1', hub.address().port]]);
      assert.equal((await daemon.rpc('wallet_balance')).total, '0.0');
      assert.deepEqual((await daemon.rpc('address_list')).items.map(item => item.address).sort(), initialAddresses);
      await daemon.quitForUpdate();
      console.log('PASS: stalled sync returns to setup; a custom working hub recovers the same wallet and zero balance');
    } finally {
      await daemon.quit();
      sockets.forEach(socket => socket.destroy());
      await new Promise(resolve => stalled.close(resolve));
    }
  } finally {
    sockets.forEach(socket => socket.destroy());
    await new Promise(resolve => hub.close(resolve));
  }
  assert.equal(unexpected.size, 0);
  const log = fs.readFileSync(path.join(profile.logs, 'daemon-console.log'), 'utf8');
  assert.equal((log.match(/finished shutting down/g) || []).length, 9);
  assert(!log.includes('Task was destroyed but it is pending!'));
  console.log('PASS: packaged SDK reports completed, connected history after first start, restart and stalled-hub recovery');
  console.log('PASS: real packaged SDK preserves the empty wallet and completes eleven shutdowns across original and restored profiles cleanly');
  console.log('Evidence: ' + root);
}

main().catch(error => { console.error(error); process.exitCode = 1 });
