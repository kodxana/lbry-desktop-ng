const { createRendererGuard } = require('./rendererGuard.cjs');

function registerDownloadNotifications({ ipcMain, app, getWindow, rendererURL }) {
  const allowed = createRendererGuard(getWindow, rendererURL);
  let badgeNumber = 0;
  let revision = 0;
  const snapshot = () => ({ revision, badgeNumber });
  const publish = (window) => {
    revision++;
    if (app.dock) app.dock.setBadge(badgeNumber ? String(badgeNumber) : '');
    if (window.isDestroyed() || window.webContents.isDestroyed()) return;
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    if (allowed(event, window)) window.webContents.send('download-notification-state', snapshot());
  };
  ipcMain.handle('download-notifications', (event, command) => {
    const window = getWindow();
    if (!allowed(event, window)) return { ok: false, error: 'sender' };
    if (command === 'completed') {
      badgeNumber = window.isFocused() ? 0 : badgeNumber + 1;
      publish(window);
    } else if (command !== 'state') return { ok: false, error: 'invalid' };
    return { ok: true, state: snapshot() };
  });
  return (window) => {
    const focused = () => {
      if (window !== getWindow() || window.isDestroyed()) return;
      badgeNumber = 0;
      publish(window);
    };
    window.on('focus', focused);
    window.once('closed', () => window.removeListener('focus', focused));
  };
}

module.exports = { registerDownloadNotifications };
