/* eslint no-console:0 */
const assert = require('assert').strict;
const { EventEmitter } = require('events');
const { registerDesktopInfo } = require('../electron/desktopInfo.cjs');
const { registerDownloadNotifications } = require('../electron/downloadNotifications.cjs');

function fixture(dock = true) {
  const ipcMain = new EventEmitter();
  const handlers = {};
  ipcMain.handle = (channel, handler) => (handlers[channel] = handler);
  const badges = [];
  const sent = [];
  const paths = { downloads: '/fixture/downloads', home: '/fixture/home' };
  const frame = { url: 'file:///fixture/index.html?phase=test#/wallet' };
  const window = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    isFocused: () => false,
    webContents: { isDestroyed: () => false, mainFrame: frame, send: (...args) => sent.push(args) },
  });
  const app = {
    getVersion: () => '0.54.0-rc.3',
    getLocale: () => 'pl-PL',
    getAppPath: () => '/fixture/app.asar',
    getPath: (name) => {
      if (paths[name] instanceof Error) throw paths[name];
      return paths[name];
    },
    dock: dock ? { setBadge: (value) => badges.push(value) } : undefined,
  };
  const event = { sender: window.webContents, senderFrame: frame };
  const state = { window, current: window, event, paths, badges, sent };
  const options = { ipcMain, app, getWindow: () => state.current, rendererURL: 'file:///fixture/index.html' };
  registerDesktopInfo(options);
  registerDownloadNotifications(options)(window);
  state.info = (command) => handlers['desktop-info'](event, command);
  state.download = (command) => handlers['download-notifications'](event, command);
  state.cookiePath = () => {
    ipcMain.emit('cookie-app-path', event);
    return event.returnValue;
  };
  return state;
}

const info = fixture();
assert.deepEqual(info.info('metadata'), { ok: true, version: '0.54.0-rc.3', locale: 'pl-PL' });
assert.deepEqual(info.cookiePath(), { ok: true, path: '/fixture/app.asar' });
assert.deepEqual(info.info('backup-directory'), { ok: true, directory: '/fixture/downloads' });
for (const unavailable of ['', undefined, new Error('OS directory unavailable')]) {
  info.paths.downloads = unavailable;
  assert.deepEqual(info.info('backup-directory'), { ok: true, directory: '/fixture/home' });
}
info.paths.home = new Error('OS directory unavailable');
assert.deepEqual(info.info('backup-directory'), { ok: true, directory: null });
for (const command of [undefined, null, {}, ['metadata'], 'getPath', 'userData', 'constructor']) {
  assert.deepEqual(info.info(command), { ok: false, error: 'invalid' });
  assert.deepEqual(info.download(command), { ok: false, error: 'invalid' });
}

for (const dock of [true, false]) {
  const f = fixture(dock);
  assert.deepEqual(f.download('state'), { ok: true, state: { revision: 0, badgeNumber: 0 } });
  for (const count of [1, 2]) {
    assert.equal(f.download('completed').state.badgeNumber, count);
    assert.deepEqual(f.sent[count - 1], ['download-notification-state', { revision: count, badgeNumber: count }]);
  }
  f.window.isFocused = () => true;
  f.window.emit('focus');
  assert.equal(f.download('state').state.badgeNumber, 0);
  assert.equal(f.download('completed').state.badgeNumber, 0, 'Foreground completion must not create an unread badge');
  assert.deepEqual(f.badges, dock ? ['1', '2', '', ''] : []);
  f.window.webContents.isDestroyed = () => true;
  f.window.emit('focus');
  assert.equal(f.sent.length, 4, 'Never publish to destroyed web contents');
  f.window.emit('closed');
  assert.equal(f.window.listenerCount('focus'), 0);
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
    f.event.senderFrame = null;
  },
  (f) => {
    f.event.senderFrame = { url: f.event.senderFrame.url };
  },
  (f) => {
    f.event.senderFrame.url = 'file:///fixture/other.html';
  },
  (f) => {
    f.event.senderFrame.url = 'https://example.invalid/';
  },
]) {
  const f = fixture();
  invalidate(f);
  for (const command of ['metadata', 'backup-directory']) {
    assert.deepEqual(f.info(command), { ok: false, error: 'sender' });
  }
  assert.deepEqual(f.cookiePath(), { ok: false, error: 'sender' });
  for (const command of ['completed', 'state']) {
    assert.deepEqual(f.download(command), { ok: false, error: 'sender' });
  }
  assert.deepEqual(f.badges, []);
  assert.deepEqual(f.sent, []);
}
console.log(
  'PASS: desktop metadata and backup fallbacks, cookie path guard, download counts, focus reset and sender restrictions'
);
