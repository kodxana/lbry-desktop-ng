const fs = require('fs');
const path = require('path');
const { app, ipcMain } = require('electron');
const { registerDesktopInfo } = require('../../electron/desktopInfo.cjs');
const { registerDownloadNotifications } = require('../../electron/downloadNotifications.cjs');

module.exports = (root, getWindow, rendererURL) => {
  const downloads = path.join(root, 'fixture-downloads');
  const home = path.join(root, 'fixture-home');
  const blocked = path.join(root, 'blocked-backup');
  fs.mkdirSync(home);
  fs.writeFileSync(blocked, 'fixture');
  let mode = 'downloads';
  let release;
  let pending = false;
  let calls = 0;
  registerDesktopInfo({
    ipcMain: {
      on: (...args) => ipcMain.on(...args),
      handle: (channel, handler) =>
        ipcMain.handle(channel, async (event, command) => {
          if (command === 'backup-directory') {
            calls++;
            if (mode === 'reject') throw new Error('Synthetic information failure');
            if (mode === 'hold') {
              pending = true;
              await new Promise((resolve) => {
                release = resolve;
              });
              pending = false;
            }
          }
          return handler(event, command);
        }),
    },
    app: {
      getAppPath: () => app.getAppPath(),
      getVersion: () => app.getVersion(),
      getLocale: () => 'pl-PL',
      getPath: (name) => {
        if (mode === 'missing') throw new Error('OS folders unavailable');
        if (name === 'home') return home;
        if (mode === 'home') return '';
        return mode === 'blocked' ? blocked : downloads;
      },
    },
    getWindow,
    rendererURL,
  });
  ipcMain.handle('fixture-desktop-info', (_event, command) => {
    if (command === 'release') {
      mode = 'downloads';
      release();
    } else if (command) mode = command;
    return { root, downloads, home, pending, calls };
  });
  const badges = [];
  const attach = registerDownloadNotifications({
    ipcMain,
    app: { dock: { setBadge: (value) => badges.push(value) } },
    getWindow,
    rendererURL,
  });
  let focused = false;
  const windowCalls = [];
  ipcMain.handle('fixture-download-notifications', (_event, command) => {
    const window = getWindow();
    if (command === 'configure') {
      focused = false;
      window.isFocused = () => focused;
      window.isMinimized = () => true;
      window.restore = () => windowCalls.push('restore');
      window.show = () => windowCalls.push('show');
      window.focus = () => {
        windowCalls.push('focus');
        focused = true;
        window.emit('focus');
      };
      attach(window);
    } else if (command === 'focus') {
      focused = true;
      window.emit('focus');
    } else if (command === 'blur') focused = false;
    return { badges, windowCalls };
  });
};
