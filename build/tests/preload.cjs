// Only the fixture runner has Node access. Production uses electron/preload.cjs.
const { ipcRenderer, webFrame, webUtils } = require('electron');
const { createDesktopBridge } = require('../../electron/desktopBridge.cjs');
window.lbryDesktop = createDesktopBridge({
  ipcRenderer,
  webFrame,
  webUtils,
  platform: process.platform,
  electron: process.versions.electron,
  appImage: false,
  sandboxed: false,
});
