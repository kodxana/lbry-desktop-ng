const { contextBridge, ipcRenderer, webFrame, webUtils } = require('electron');
const { createDesktopBridge } = require('./desktopBridge.cjs');

const prefix = '--lbry-renderer-url=';
const argument = process.argv.find((value) => value.startsWith(prefix));
const actual = new URL(location.href);
actual.search = '';
actual.hash = '';
if (process.isMainFrame && argument && actual.href === new URL(argument.slice(prefix.length)).href) {
  contextBridge.exposeInMainWorld(
    'lbryDesktop',
    createDesktopBridge({
      ipcRenderer,
      webFrame,
      webUtils,
      platform: process.platform,
      electron: process.versions.electron,
      sandboxed: process.sandboxed === true,
      appImage: process.argv.includes('--lbry-appimage'),
    })
  );
}
