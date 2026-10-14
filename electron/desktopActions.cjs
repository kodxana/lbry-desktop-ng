const { createRendererGuard } = require('./rendererGuard.cjs');

function registerDesktopActions({ ipcMain, shell, profile, launcher, getWindow, rendererURL }) {
  const allowed = createRendererGuard(getWindow, rendererURL);
  ipcMain.handle('open-external', (event, value) => {
    if (!allowed(event) || typeof value !== 'string') throw new Error('Invalid external URL');
    const url = new URL(value);
    if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) throw new Error('Unsupported external URL');
    return shell.openExternal(url.href);
  });
  ipcMain.handle('open-profile-folder', (event, folder) => {
    if (!allowed(event) || !['logs', 'data'].includes(folder)) throw new Error('Invalid folder');
    return shell.openPath(profile[folder]);
  });
  ipcMain.handle('auto-launch', (event, command) => {
    if (!allowed(event) || !['enable', 'disable', 'isEnabled'].includes(command)) throw new Error('Invalid command');
    return launcher[command]();
  });
}

module.exports = { registerDesktopActions };
