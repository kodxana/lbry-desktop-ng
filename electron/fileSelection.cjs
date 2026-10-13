const fs = require('fs');
const path = require('path');
const mime = require('mime');
const { createRendererGuard } = require('./rendererGuard.cjs');

async function getFileFromPath(filePath, readContents = true) {
  const stats = await fs.promises.stat(filePath);
  const name = path.basename(filePath);
  return {
    name,
    path: filePath,
    mime: stats.isDirectory() ? undefined : mime.getType(name) || undefined,
    buffer: stats.isDirectory() || !readContents ? new ArrayBuffer(0) : await fs.promises.readFile(filePath),
  };
}

function validRequest(request) {
  return (
    request &&
    typeof request === 'object' &&
    Object.keys(request).every((key) => ['type', 'filters', 'readFile'].includes(key)) &&
    ['openFile', 'openDirectory'].includes(request.type) &&
    (request.readFile === undefined || typeof request.readFile === 'boolean') &&
    (request.filters === undefined ||
      (Array.isArray(request.filters) &&
        request.filters.every(
          (filter) =>
            filter &&
            typeof filter.name === 'string' &&
            Array.isArray(filter.extensions) &&
            filter.extensions.length > 0 &&
            filter.extensions.every(
              (extension) => typeof extension === 'string' && /^(\*|[a-z0-9_-]+)$/i.test(extension)
            )
        )))
  );
}

function registerFileSelection({ ipcMain, app, dialog, getWindow, rendererURL, onSelected, platform = process.platform }) {
  let pending = false;
  const lastDirectories = {};
  const allowed = createRendererGuard(getWindow, rendererURL);

  ipcMain.handle('select-file', async (event, request) => {
    const window = getWindow();
    if (!allowed(event, window)) return { ok: false, error: 'sender' };
    if (!validRequest(request)) return { ok: false, error: 'invalid' };
    if (pending) return { ok: false, error: 'busy' };
    pending = true;
    try {
      const options = { properties: [request.type] };
      if (lastDirectories[request.type]) options.defaultPath = lastDirectories[request.type];
      else if (platform === 'win32') options.defaultPath = app.getPath('home');
      if (request.filters) {
        options.filters = request.filters.map(({ name, extensions }) => ({ name, extensions }));
      }
      const result = await dialog.showOpenDialog(window, options);
      if (!allowed(event, window)) return { ok: false, error: 'sender' };
      if (result.canceled || !result.filePaths.length) return { ok: true, file: null };
      // Read only the path returned by the native picker, never a renderer-supplied path.
      const file = await getFileFromPath(result.filePaths[0], request.readFile);
      if (!allowed(event, window)) return { ok: false, error: 'sender' };
      if (onSelected) await onSelected(file.path);
      if (!allowed(event, window)) return { ok: false, error: 'sender' };
      // Electron 43 no longer lets the OS remember a dialog's last directory.
      // Remember successful selections separately for file and folder pickers.
      lastDirectories[request.type] = request.type === 'openDirectory' ? file.path : path.dirname(file.path);
      return { ok: true, file };
    } catch (_) {
      return { ok: false, error: 'selection' };
    } finally {
      pending = false;
    }
  });
}

module.exports = { registerFileSelection };
