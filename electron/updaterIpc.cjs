const { createRendererGuard } = require('./rendererGuard.cjs');

function validCommand(command, value) {
  if (['state', 'accept', 'decline'].includes(command)) return value === undefined;
  if (command === 'prereleases') return typeof value === 'boolean';
  return (
    command === 'check' &&
    value &&
    typeof value === 'object' &&
    Object.keys(value).every((key) => ['autoDownload', 'allowPrerelease'].includes(key)) &&
    typeof value.autoDownload === 'boolean' &&
    typeof value.allowPrerelease === 'boolean'
  );
}

function registerUpdaterIpc({ ipcMain, updates, getWindow, rendererURL }) {
  const allowed = createRendererGuard(getWindow, rendererURL);
  const publish = (state) => {
    const window = getWindow();
    if (!window || window.isDestroyed()) return;
    const sender = window.webContents;
    if (!sender.isDestroyed() && allowed({ sender, senderFrame: sender.mainFrame }, window)) {
      sender.send('desktop-updater-state', state);
    }
  };
  updates.on('state', publish);
  ipcMain.handle('desktop-updater', async (event, command, value) => {
    if (!allowed(event)) return { ok: false, error: 'sender' };
    if (!validCommand(command, value)) return { ok: false, error: 'invalid' };
    try {
      switch (command) {
        case 'check':
          await updates.check(value);
          break;
        case 'prereleases':
          updates.setPrereleases(value);
          break;
        case 'accept':
          await updates.accept();
          break;
        case 'decline':
          updates.decline();
          break;
      }
      return { ok: true, state: updates.snapshot() };
    } catch (_) {
      return { ok: false, error: 'operation' };
    }
  });
  return () => {
    ipcMain.removeHandler('desktop-updater');
    updates.removeListener('state', publish);
  };
}

module.exports = { registerUpdaterIpc };
