const { createRendererGuard } = require('./rendererGuard.cjs');
const path = require('path');

function registerDesktopInfo({ ipcMain, app, getWindow, rendererURL }) {
  const allowed = createRendererGuard(getWindow, rendererURL);
  ipcMain.handle('desktop-info', (event, command) => {
    if (!allowed(event)) return { ok: false, error: 'sender' };
    if (command === 'metadata') return { ok: true, version: app.getVersion(), locale: app.getLocale() };
    if (command !== 'backup-directory') return { ok: false, error: 'invalid' };
    for (const name of ['downloads', 'home']) {
      try {
        const directory = app.getPath(name);
        if (directory) return { ok: true, directory };
      } catch (_) {
        // Electron can throw when an OS folder is unavailable.
      }
    }
    return { ok: true, directory: null };
  });
  // document.cookie is synchronous. The legacy cookie adapter needs this one
  // path during startup to preserve its existing file:// URL mapping.
  ipcMain.on('cookie-app-path', (event) => {
    event.returnValue = allowed(event) ? { ok: true, path: app.getAppPath() } : { ok: false, error: 'sender' };
  });
  ipcMain.on('cookie-location', (event) => {
    if (!allowed(event)) {
      event.returnValue = { ok: false, error: 'sender' };
      return;
    }
    const location = new URL(event.senderFrame.url);
    // Preserve the original cookie adapter's OS-specific mapping, including Windows paths.
    const relativePath = path.relative(app.getAppPath(), decodeURI(location.pathname));
    event.returnValue = { ok: true,
url: location.protocol === 'file:'
      ? 'https://lbry.tv/' + encodeURI(relativePath) + location.search + location.hash
      : location.href };
  });
}

module.exports = { registerDesktopInfo };
