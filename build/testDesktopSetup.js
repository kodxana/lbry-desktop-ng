/* eslint no-console:0 */
const assert = require('assert').strict;
const path = require('path');
const net = require('net');
const diskTests = require('./testDiskSpace');
const { GENESIS, parseServer, probeHub, probeHubs, HubSelection } = require('../electron/hubServers.cjs');

async function hostingTests() {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { transformFileSync } = require('@babel/core');
  const vm = require('vm');
  let submit;
  const changed = [];
  let finished = false;
  const label = props => React.createElement('label', null, props.label, props.helper);
  const dependencies = {
    react: React,
    'util/desktop': { requestDiskSpace() {} },
    'component/button': label,
    'component/common/form-components/form-field': { FormField: label },
    'component/common/form-components/form': { Form: props => { submit = props.onSubmit; return props.children } },
    'react-router-dom': { withRouter: component => component },
    'static/img/yrblhappy.svg': '',
    'constants/daemon_settings': { BLOB_STORAGE_LIMIT_MB: 'blob_storage_limit', NETWORK_STORAGE_LIMIT_MB: 'network_storage_limit' },
  };
  const { code } = transformFileSync(path.join(__dirname, '../ui/component/hostingSplash/view.jsx'), {
    babelrc: false,
configFile: false,
presets: ['@babel/preset-react', '@babel/preset-flow'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const context = { exports: {},
__: text => text,
require: name => {
    assert(Object.prototype.hasOwnProperty.call(dependencies, name), 'Unexpected import: ' + name);
    return dependencies[name];
  } };
  vm.runInNewContext(code, context);
  const Component = context.exports.default;
  const props = {
    diskSpace: null,
viewHostingLimit: 0,
autoHostingLimit: 0,
viewBlobSpace: 0,
autoBlobSpace: 0,
saveBlobs: true,
    setDaemonSetting: (name, value) => { changed.push([name, value]) },
handleDone: () => { finished = true },
  };
  const unavailable = renderToStaticMarkup(React.createElement(Component, props));
  assert(unavailable.includes('Storage information is unavailable'));
  assert(!unavailable.includes('disk is almost full'));
  await submit();
  assert(finished && changed.length === 0, 'Unknown storage must not change hosting limits');
  const full = renderToStaticMarkup(React.createElement(Component, { ...props, diskSpace: { total: 1073741824, free: 0 } }));
  assert(full.includes('disk is almost full'));
  await submit();
  assert.equal(changed.length, 0, 'A full drive must not increase hosting limits');
  renderToStaticMarkup(React.createElement(Component, { ...props, diskSpace: { total: 1073741824, free: 268435456 } }));
  await submit();
  assert.deepEqual(changed, [['blob_storage_limit', 94208], ['network_storage_limit', 10240]],
    'A 1 TiB drive with 256 GiB available must produce MiB hosting limits from KiB readings');
  console.log('PASS: unknown/full storage preserves settings; known capacity produces the expected hosting limits');
}

async function protocolTests() {
  assert.equal(parseServer(['hub.example', 50001]).endpoint, 'hub.example:50001');
  for (const value of ['host:0', 'host:65536', 'host:abc', 'host:1:2', 'x\n:1', null]) assert.throws(() => parseServer(value));
  const sockets = new Set();
  let mode = 'valid';
  let protocol = '0.113.0';
  const methods = [];
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    let pending = '';
    socket.on('data', chunk => {
      pending += chunk;
      while (pending.includes('\n')) {
        const index = pending.indexOf('\n');
        const request = JSON.parse(pending.slice(0, index));
        pending = pending.slice(index + 1);
        methods.push(request.method);
        if (mode === 'timeout') continue;
        if (mode === 'close') { socket.end(); continue }
        if (mode === 'garbage') { socket.write('not json\n'); continue }
        if (mode === 'oversize') { socket.write('x'.repeat(70000)); continue }
        const result = request.id === 1 ? ['fixture', mode === 'old' ? '0.1.0' : protocol]
          : { genesis_hash: mode === 'wrong-network' ? '0'.repeat(64) : GENESIS };
        const response = JSON.stringify({ id: mode === 'wrong-id' ? 90 : request.id, result }) + '\n';
        socket.write(response.slice(0, 8));
        setTimeout(() => { if (!socket.destroyed) socket.write(response.slice(8)); }, 5);
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = '127.0.0.1:' + server.address().port;
  try {
    const valid = await probeHub(endpoint);
    assert.equal(valid.error, null);
    assert(valid.latency > 0);
    assert.deepEqual(methods, ['server.version', 'server.features']);
    for (const [version, compatible] of [
      ['0.64.999', false], ['0.65.0-rc.1', false], ['0.65.0', true], ['0.65.0+build.1', true],
      ['0.113.0-rc.1', true], ['v0.113.0', true], ['0.113', false], ['^0.113.0', false],
      ['0.0113.0', false], ['0.113.0-rc.01', false],
      [' 0.113.0', false], ['0.113.0 ', false], ['\t0.113.0', false], ['0.113.0\n', false],
      ['9007199254740992.0.0', false], ['0.113.0-' + 'a'.repeat(1000), false],
      [null, false], [113, false], [{}, false], [[], false],
    ]) {
      protocol = version;
      methods.length = 0;
      const checked = await probeHub(endpoint);
      assert.equal(checked.error, compatible ? null : 'Incompatible protocol', JSON.stringify(version));
      assert.deepEqual(methods, compatible ? ['server.version', 'server.features'] : ['server.version']);
    }
    protocol = '0.113.0';
    console.log('PASS: hub protocol threshold, prerelease/build metadata and malformed version rejection before features');
    for (const [testMode, expected] of [['old', 'Incompatible protocol'], ['wrong-network', 'Wrong network'],
      ['wrong-id', 'Invalid response'], ['garbage', 'Invalid response'], ['oversize', 'Invalid response'],
      ['timeout', 'Timed out'], ['close', 'Connection closed']]) {
      mode = testMode;
      assert.equal((await probeHub(endpoint, 100)).error, expected);
    }
  } finally {
    sockets.forEach(socket => socket.destroy());
    await new Promise(resolve => server.close(resolve));
  }
  assert.equal((await probeHub(endpoint)).error, 'Unreachable');
  let active = 0;
  let maxActive = 0;
  const results = await probeHubs(Array.from({ length: 9 }, (_, i) => `host${i}:50001`), async endpoint => {
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return { endpoint, latency: 9 - Number(endpoint[4]) };
  });
  assert.equal(maxActive, 4);
  assert.equal(results[0].endpoint, 'host8:50001');
  await assert.rejects(probeHubs(Array.from({ length: 65 }, (_, i) => `host${i}:1`)), /Too many/);
  console.log('PASS: LBRY handshake, network check, fragmented replies, malformed/oversized replies, timeouts and bounded concurrency');
}

async function selectionTests() {
  const original = ['first:50001', 'second:50001'];
  let configured = original.slice();
  let custom = false;
  let failStart = false;
  let failRestore = false;
  let reprobeFails = false;
  let restarts = 0;
  const selection = new HubSelection({
    hasCustomServers: () => custom,
    probe: async endpoint => ({ ...parseServer(endpoint), latency: 2, error: reprobeFails ? 'Timed out' : null }),
    rpc: async (method, params) => {
      if (method === 'settings_get') { return { lbryum_servers: configured.map(endpoint => {
        const { host, port } = parseServer(endpoint);
        return [host, port];
      }) }; }
      if (method === 'settings_set') { configured = params.value; custom = true }
      if (method === 'settings_clear') { configured = original.slice(); custom = false }
      assert.notEqual(method, 'status', 'Selection must not wait for wallet synchronization');
    },
    restart: async settingsOnly => {
      restarts++;
      if (failStart && (!settingsOnly || failRestore)) throw new Error('Fixture startup failure');
    },
  });
  await assert.rejects(selection.select('unoffered:1'), /Check the hubs/);
  await selection.scan();
  assert.equal(await selection.select(null), null);
  assert.equal(restarts, 1, 'Automatic selection must start the normal SDK');
  assert(!custom, 'Automatic selection must leave defaults untouched');
  await assert.rejects(selection.select(original[0]), /Open hub setup/);
  await selection.prepare();
  reprobeFails = true;
  await assert.rejects(selection.select(original[0]), /no longer responding/);
  assert.equal(restarts, 2);
  reprobeFails = false;
  const inFlight = selection.select(original[0]);
  await assert.rejects(selection.select(original[1]), /Wait/);
  await assert.rejects(selection.scan(), /already in progress/);
  assert.equal((await inFlight).endpoint, original[0]);
  assert.deepEqual(configured, [original[0]]);
  assert(custom);
  await selection.prepare();
  const recoveryChoices = await selection.scan();
  assert.deepEqual(recoveryChoices.servers.map(server => server.endpoint).sort(), original,
    'Returning from a manual hub must still offer the other previously checked servers');
  assert.deepEqual(configured, [original[0]], 'Scanning alternatives must not change the wallet preference');
  await assert.rejects(selection.select('custom.example:50001'), /Check the hubs/);
  assert.equal((await selection.checkCustom('custom.example:50001')).error, null);
  await selection.select('custom.example:50001');
  assert.deepEqual(configured, ['custom.example:50001']);
  await selection.prepare();
  await selection.select(null);
  assert(!custom);
  await selection.prepare();
  failStart = true;
  await assert.rejects(selection.select(original[0]), /previous hub setting was restored/);
  assert.deepEqual(configured, original);
  assert(!custom, 'Rollback must restore automatic discovery, not pin the default list');
  custom = true;
  await assert.rejects(selection.select(original[0]), /previous hub setting was restored/);
  assert(custom, 'Rollback must preserve an existing custom list');
  failRestore = true;
  await assert.rejects(selection.select(original[0]), /could not restart or restore/);
  console.log('PASS: pre-sync selection, custom hub checks, automatic choice, duplicate requests and startup failure recovery');
}

async function main() {
  await diskTests();
  await hostingTests();
  await protocolTests();
  await selectionTests();
  await require('./testStartup')();
  await require('./testWalletSync')();
}
main().catch(error => { console.error(error); process.exitCode = 1 });
