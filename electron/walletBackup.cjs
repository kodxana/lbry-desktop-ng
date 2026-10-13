const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { createRendererGuard } = require('./rendererGuard.cjs');

function registerWalletBackup({ ipcMain, app, shell, rpc, getWindow, rendererURL, filesystem = fs }) {
  const allowed = createRendererGuard(getWindow, rendererURL);
  let pending;
  ipcMain.on('wallet-backup-cancel', (event, id) => {
    if (allowed(event) && pending && pending.id === id) pending.canceled = true;
  });
  ipcMain.handle('wallet-folder', async (event) => {
    if (!allowed(event)) return { ok: false, error: 'sender' };
    try {
      const { wallet_dir } = await rpc('settings_get');
      if (!allowed(event) || !wallet_dir || !path.isAbsolute(wallet_dir)) return { ok: false, error: 'wallet' };
      const error = await shell.openPath(wallet_dir);
      return error ? { ok: false, error: 'open' } : { ok: true };
    } catch (_) {
      return { ok: false, error: 'wallet' };
    }
  });
  ipcMain.handle('wallet-backup', async (event, request) => {
    const window = getWindow();
    if (!allowed(event, window)) return { ok: false, error: 'sender' };
    if (
      !request ||
      typeof request.id !== 'string' ||
      request.id.length > 100 ||
      typeof request.directory !== 'string' ||
      !path.isAbsolute(request.directory)
    ) {
      return { ok: false, error: 'wallet' };
    }
    if (pending) return { ok: false, error: 'busy' };
    pending = { id: request.id, canceled: false };
    try {
      const { wallet_dir } = await rpc('settings_get');
      if (!allowed(event, window) || pending.canceled) return { ok: false, error: 'sender' };
      if (wallet_dir !== request.directory) return { ok: false, error: 'wallet' };
      let destination;
      for (const name of ['downloads', 'home']) {
        try {
          destination = app.getPath(name);
        } catch (_) {
          /* Try the next OS folder. */
        }
        if (destination) break;
      }
      destination = destination || path.dirname(wallet_dir);
      const archive = new AdmZip();
      // Do not follow links out of the wallet folder or silently omit their contents.
      const addDirectory = (directory, prefix = '') => {
        for (const entry of filesystem.readdirSync(directory)) {
          const filename = path.join(directory, entry);
          const stat = filesystem.lstatSync(filename);
          if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory()))
            { throw new Error('Unsupported wallet entry') }
          if (stat.isDirectory()) {
            archive.addFile(prefix + entry + '/', Buffer.alloc(0));
            addDirectory(filename, prefix + entry + '/');
          } else archive.addFile(prefix + entry, filesystem.readFileSync(filename));
        }
      };
      let bytes;
      try {
        addDirectory(wallet_dir);
        bytes = archive.toBuffer();
      } catch (_) {
        return { ok: false, error: 'archive' };
      }
      if (!allowed(event, window)) return { ok: false, error: 'sender' };
      const filename = path.basename(wallet_dir) + '-' + new Date().toISOString().replace(/:/g, '-') + '.zip';
      const outputPath = path.join(destination, filename);
      let fd;
      try {
        fd = filesystem.openSync(outputPath, 'wx', 0o600);
        filesystem.writeFileSync(fd, bytes);
        filesystem.fsyncSync(fd);
      } catch (_) {
        if (fd !== undefined) {
          filesystem.closeSync(fd);
          fd = undefined;
          filesystem.unlinkSync(outputPath);
        }
        return { ok: false, error: 'write' };
      } finally {
        if (fd !== undefined) filesystem.closeSync(fd);
      }
      // A reveal failure must not hide the fact that the backup was saved.
      try {
        shell.showItemInFolder(outputPath);
      } catch (_) {
        /* The UI displays the saved path. */
      }
      return { ok: true, path: outputPath };
    } catch (_) {
      return { ok: false, error: 'wallet' };
    } finally {
      pending = null;
    }
  });
}

module.exports = { registerWalletBackup };
