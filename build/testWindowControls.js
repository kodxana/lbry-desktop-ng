/* eslint no-console:0 */
const assert = require('assert').strict;
const { EventEmitter } = require('events');
const { registerWindowControls, forwardFullscreenEvents } = require('../electron/windowControls.cjs');

function fixture(rendererURL = 'file:///fixture/index.html') {
  const ipcMain = new EventEmitter();
  const calls = [];
  const frame = { url: rendererURL + '?fixture=true#/wallet' };
  const window = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    webContents: { isDestroyed: () => false, mainFrame: frame, send: (...args) => calls.push(args) },
    maximize: () => calls.push('maximize'),
    isMinimized: () => true,
    restore: () => calls.push('restore'),
    show: () => calls.push('show'),
    focus: () => calls.push('focus'),
    setFullScreen: (value) => calls.push(['fullscreen', value]),
  });
  const app = { quit: () => calls.push('quit') };
  const event = { sender: window.webContents, senderFrame: frame };
  const state = { window, calls, event, current: window };
  registerWindowControls({ ipcMain, app, getWindow: () => state.current, rendererURL });
  state.send = (command) => ipcMain.emit('window-control', event, command);
  return state;
}

for (const url of ['file:///fixture/index.html', 'http://localhost:9090/']) {
  const f = fixture(url);
  for (const command of ['maximize', 'leave-fullscreen', 'focus', 'quit']) f.send(command);
  assert.deepEqual(f.calls, ['maximize', ['fullscreen', false], 'restore', 'show', 'focus', 'quit']);
  f.calls.length = 0;
  f.window.isMinimized = () => false;
  f.send('focus');
  assert.deepEqual(f.calls, ['show', 'focus']);
  f.calls.length = 0;
  for (const command of [
    undefined,
    null,
    '',
    'close',
    'exit',
    'destroy',
    'setFullScreen',
    'constructor',
    {},
    ['quit'],
  ]) {
    f.send(command);
  }
  assert.deepEqual(f.calls, [], 'Unknown commands must never dispatch arbitrary methods');
}

for (const invalidate of [
  (f) => {
    f.current = null;
  },
  (f) => {
    f.current = fixture().window;
  },
  (f) => {
    f.window.isDestroyed = () => true;
  },
  (f) => {
    f.window.webContents.isDestroyed = () => true;
  },
  (f) => {
    f.event.sender = {};
  },
  (f) => {
    f.event.senderFrame = { url: f.event.senderFrame.url };
  },
  (f) => {
    f.event.senderFrame = null;
  },
  (f) => {
    f.event.senderFrame.url = 'https://example.invalid/';
  },
  (f) => {
    f.event.senderFrame.url = 'file:///fixture/other.html';
  },
  (f) => {
    f.event.senderFrame.url = 'invalid URL';
  },
]) {
  const f = fixture();
  invalidate(f);
  for (const command of ['maximize', 'leave-fullscreen', 'focus', 'quit']) f.send(command);
  assert.deepEqual(f.calls, [], 'Untrusted or stale windows must not control the application');
}
const development = fixture('http://localhost:9090/');
development.event.senderFrame.url = 'http://localhost:9091/';
development.send('quit');
assert.deepEqual(development.calls, [], 'Development renderer authorization must include the port');

const events = fixture();
forwardFullscreenEvents(events.window);
events.window.emit('leave-full-screen');
assert.deepEqual(events.calls, [['window-left-fullscreen']]);
events.window.webContents.isDestroyed = () => true;
events.window.emit('leave-full-screen');
assert.equal(events.calls.length, 1, 'Do not send to destroyed web contents');
events.window.webContents.isDestroyed = () => false;
events.window.isDestroyed = () => true;
events.window.emit('leave-full-screen');
assert.equal(events.calls.length, 1, 'Do not send to a destroyed window');
events.window.emit('closed');
assert.equal(events.window.listenerCount('leave-full-screen'), 0, 'Remove the forwarding listener on close');
console.log(
  'PASS: explicit window commands, main-frame sender restrictions, normal quit lifecycle and fullscreen event cleanup'
);
