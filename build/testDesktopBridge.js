/* eslint no-console:0 */
const assert = require('assert').strict;
const { EventEmitter } = require('events');
const { createDesktopBridge } = require('../electron/desktopBridge.cjs');
const ipc = new EventEmitter();
const requests = [];
ipc.invoke = async (...values) => {
  requests.push(values);
  return { ok: true };
};
ipc.send = (...values) => requests.push(values);
let zoom = 1;
const bridge = createDesktopBridge({
  ipcRenderer: ipc,
  platform: process.platform,
  webFrame: {
    getZoomFactor: () => zoom,
    setZoomFactor: (value) => {
      zoom = value;
    },
  },
  webUtils: {
    getPathForFile: (file) => {
      if (file === 'disk-file') return '/selected/file';
      if (file === 'memory-file') return '';
      throw new TypeError('Not a File');
    },
  },
});
assert(!bridge.invoke && !bridge.send && !bridge.require && !bridge.fs && !bridge.ipcRenderer);
let received;
const stop = bridge.onUpdater((...values) => {
  received = values;
});
ipc.emit('desktop-updater-state', { sender: 'privileged object' }, { revision: 1 });
assert.deepEqual(received, [{ revision: 1 }], 'Never expose Electron event objects');
assert.equal(stop(), undefined, 'Unsubscribe must not return the privileged IPC object');
stop();
assert.equal(ipc.listenerCount('desktop-updater-state'), 0);
assert.throws(() => bridge.onUpdater(null), TypeError);
assert.equal(bridge.filePath('memory-file'), '');
assert.throws(() => bridge.filePath({ path: '/arbitrary' }), TypeError);
assert.equal(requests.length, 0, 'Synthetic files and forged paths cannot grant disk access');
assert.equal(bridge.filePath('disk-file'), '/selected/file');
assert.deepEqual(requests.pop(), ['selected-file', '/selected/file']);
for (const value of [NaN, Infinity, 0, -1, 4, '2']) bridge.setZoom(value);
assert.equal(zoom, 1);
bridge.setZoom(1.5);
assert.equal(zoom, 1.5);
console.log('PASS: named preload API, event stripping, listener disposal and native-file grants');
