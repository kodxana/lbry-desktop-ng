const fs = require('fs');
const path = require('path');
const mime = require('mime');

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

function documentURL(value) {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  return url.href;
}

function registerFileSelection({ ipcMain, app, dialog, getWindow, rendererURL, platform = process.platform }) {
  let pending = false;
  const expectedURL = documentURL(rendererURL);
  const allowed = (event, window) => {
    try {
      return (
        window &&
        window === getWindow() &&
        !window.isDestroyed() &&
        !window.webContents.isDestroyed() &&
        event.sender === window.webContents &&
        event.senderFrame === window.webContents.mainFrame &&
        documentURL(event.senderFrame.url) === expectedURL
      );
    } catch (_) {
      return false;
    }
  };

  ipcMain.handle('select-file', async (event, request) => {
    const window = getWindow();
    if (!allowed(event, window)) return { ok: false, error: 'sender' };
    if (!validRequest(request)) return { ok: false, error: 'invalid' };
    if (pending) return { ok: false, error: 'busy' };
    pending = true;
    try {
      const options = { properties: [request.type] };
      if (platform === 'win32') options.defaultPath = app.getPath('home');
      if (request.filters) {
        options.filters = request.filters.map(({ name, extensions }) => ({ name, extensions }));
      }
      const result = await dialog.showOpenDialog(window, options);
      if (!allowed(event, window)) return { ok: false, error: 'sender' };
      if (result.canceled || !result.filePaths.length) return { ok: true, file: null };
      // Read only the path returned by the native picker, never a renderer-supplied path.
      const file = await getFileFromPath(result.filePaths[0], request.readFile);
      if (!allowed(event, window)) return { ok: false, error: 'sender' };
      return { ok: true, file };
    } catch (_) {
      return { ok: false, error: 'selection' };
    } finally {
      pending = false;
    }
  });
}

module.exports = { registerFileSelection };
