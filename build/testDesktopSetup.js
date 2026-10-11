/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const net = require('net');
const { getDiskSpace, parseWindowsSpace, parsePosixSpace } = require('../electron/diskSpace.cjs');
const { GENESIS, parseServer, probeHub, probeHubs, HubSelection } = require('../electron/hubServers.cjs');

async function hostingTests() {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { transformFileSync } = require('@babel/core');
  const vm = require('vm');
  let submit;
  let changed = false;
  let finished = false;
  const label = props => React.createElement('label', null, props.label, props.helper);
  const dependencies = {
    react: React,
    electron: { ipcRenderer: { send() {} } },
    'component/button': label,
    'component/common/form-components/form-field': { FormField: label },
    'component/common/form-components/form': { Form: props => { submit = props.onSubmit; return props.children } },
    'react-router-dom': { withRouter: component => component },
    'static/img/yrblhappy.svg': '',
    'constants/daemon_settings': {},
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
    setDaemonSetting: () => { changed = true },
handleDone: () => { finished = true },
  };
  const unavailable = renderToStaticMarkup(React.createElement(Component, props));
  assert(unavailable.includes('Storage information is unavailable'));
  assert(!unavailable.includes('disk is almost full'));
  await submit();
  assert(finished && !changed, 'Unknown storage must not change hosting limits');
  const full = renderToStaticMarkup(React.createElement(Component, { ...props, diskSpace: { total: 1073741824, free: 0 } }));
  assert(full.includes('disk is almost full'));
  console.log('PASS: unknown storage differs from a full drive; continuing preserves hosting settings');
}

async function diskTests() {
  assert.deepEqual(parseWindowsSpace('{"total":1099511627776,"free":0}'), { total: 1073741824, free: 0 });
  for (const value of ['{}', 'null', '{"total":1000,"free":2000}', '{"total":0,"free":0}', '{"total":"4096","free":0}']) {
    assert.throws(() => parseWindowsSpace(value));
  }
  assert.deepEqual(parsePosixSpace('Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/test 10000 7500 2500 75% /with space\n'),
    { total: 10000, free: 2500 });
  assert.deepEqual(parsePosixSpace('Filesystem blocks used avail capacity mount\nVolume name 10000 10001 -1 100% /\n'),
    { total: 10000, free: 0 });
  assert.throws(() => parsePosixSpace('df: failed'));
  const runs = path.resolve(__dirname, '../dist/setup-tests');
  fs.mkdirSync(runs, { recursive: true });
  const directory = fs.mkdtempSync(path.join(runs, "disk ł ' $(); & "));
  try {
    const result = await getDiskSpace(directory);
    assert(result.total > 4 * 1024 * 1024, 'Capacity must not truncate to 32-bit bytes');
    assert(result.free >= 0 && result.free <= result.total);
    const parent = await getDiskSpace(runs);
    assert.equal(result.total, parent.total);
    assert(Math.abs(result.free - parent.free) < 1024 * 1024);
    await assert.rejects(getDiskSpace(path.join(directory, 'missing')), /ENOENT/);
    console.log('PASS: native disk capacity, literal Unicode paths, missing directory, zero free space and df parsing');
  } finally { fs.rmdirSync(directory) }
}

async function protocolTests() {
  assert.equal(parseServer(['hub.example', 50001]).endpoint, 'hub.example:50001');
  for (const value of ['host:0', 'host:65536', 'host:abc', 'host:1:2', 'x\n:1', null]) assert.throws(() => parseServer(value));
  const sockets = new Set();
  let mode = 'valid';
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
        const result = request.id === 1 ? ['fixture', mode === 'old' ? '0.1.0' : '0.113.0']
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
  let connected = true;
  let failConnection = false;
  let failRestore = false;
  let reprobeFails = false;
  let restarts = 0;
  const selection = new HubSelection({
    connectionTimeout: 1,
    hasCustomServers: () => custom,
    probe: async endpoint => ({ ...parseServer(endpoint), latency: 2, error: reprobeFails ? 'Timed out' : null }),
    rpc: async (method, params) => {
      if (method === 'settings_get') { return { lbryum_servers: configured.map(endpoint => {
        const { host, port } = parseServer(endpoint);
        return [host, port];
      }) }; }
      if (method === 'settings_set') { configured = params.value; custom = true }
      if (method === 'settings_clear') { configured = original.slice(); custom = false }
      if (method === 'status') return { wallet: { available_servers: connected ? 1 : 0 } };
    },
    restart: async () => {
      restarts++;
      connected = !(failConnection && (configured.length === 1 || failRestore));
    },
  });
  await assert.rejects(selection.select('unoffered:1'), /Check the hubs/);
  await selection.scan();
  assert.equal(await selection.select(null), null);
  assert.equal(restarts, 0, 'Automatic selection must leave defaults untouched');
  reprobeFails = true;
  await assert.rejects(selection.select(original[0]), /no longer responding/);
  assert.equal(restarts, 0);
  reprobeFails = false;
  const inFlight = selection.select(original[0]);
  await assert.rejects(selection.select(original[1]), /Wait/);
  await assert.rejects(selection.scan(), /already in progress/);
  assert.equal((await inFlight).endpoint, original[0]);
  assert.deepEqual(configured, [original[0]]);
  assert(custom);
  await selection.select(null);
  assert(!custom);
  failConnection = true;
  await assert.rejects(selection.select(original[0]), /previous connection has been restored/);
  assert.deepEqual(configured, original);
  assert(!custom, 'Rollback must restore automatic discovery, not pin the default list');
  custom = true;
  await assert.rejects(selection.select(original[0]), /previous connection has been restored/);
  assert(custom, 'Rollback must preserve an existing custom list');
  failRestore = true;
  await assert.rejects(selection.select(original[0]), /could not be restored/);
  console.log('PASS: hub save, automatic choice, duplicate requests, reprobe, rollback and recovery failure reporting');
}

async function main() {
  await diskTests();
  await hostingTests();
  await protocolTests();
  await selectionTests();
}
main().catch(error => { console.error(error); process.exitCode = 1 });
