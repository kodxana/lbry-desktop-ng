const fs = require('fs');
const path = require('path');
const mime = require('mime');
const { createRendererGuard } = require('./rendererGuard.cjs');

const MAX_BYTES = 500000000;
const OPEN_EXTENSIONS = new Set([
  '.pdf',
  '.txt',
  '.md',
  '.rtf',
  '.doc',
  '.docx',
  '.odt',
  '.epub',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.tiff',
  '.mp4',
  '.m4v',
  '.mkv',
  '.webm',
  '.mov',
  '.avi',
  '.mp3',
  '.m4a',
  '.aac',
  '.ogg',
  '.wav',
  '.flac',
]);

function registerContentFiles({ ipcMain, shell, rpc, profile, probe, getWindow, rendererURL }) {
  const allowed = createRendererGuard(getWindow, rendererURL);
  const selected = new Map();
  const grant = (filename) => {
    if (typeof filename !== 'string' || !path.isAbsolute(filename)) return;
    const resolved = fs.promises.realpath(filename).catch(() => null);
    selected.set(filename, resolved);
    return resolved;
  };
  const authorize = async (filename) => {
    if (typeof filename !== 'string' || !path.isAbsolute(filename)) throw new Error('Invalid path');
    const real = await fs.promises.realpath(filename);
    if (selected.has(filename) && (await selected.get(filename)) === real) return real;
    // Download paths come from the owned SDK, not from renderer assertions.
    const result = await rpc('file_list', { download_path: filename, page_size: 1 });
    if (!result.items || !result.items.some((file) => file.download_path === filename)) throw new Error('Unknown file');
    if ((await fs.promises.realpath(filename)) !== real) throw new Error('File changed');
    return real;
  };
  ipcMain.on('selected-file', (event, filename) => {
    if (allowed(event)) grant(filename);
  });
  const handle = (channel, run) =>
    ipcMain.handle(channel, async (event, value) => {
      const window = getWindow();
      if (!allowed(event, window)) throw new Error('Unknown renderer');
      const filename = await authorize(value);
      if (!allowed(event, window)) throw new Error('Renderer changed');
      return run(filename, () => allowed(event, window));
    });
  const read = async (filename) => {
    const file = await fs.promises.open(filename, 'r');
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error('File too large to preview');
      return await file.readFile();
    } finally {
      await file.close();
    }
  };
  handle('read-document', async (filename, current) => {
    const bytes = await read(filename);
    if (!current()) throw new Error('Renderer changed');
    return bytes;
  });
  handle('get-file-details-from-path', async (filename, current) => {
    const stat = await fs.promises.stat(filename);
    if (!stat.isFile()) throw new Error('Expected a file');
    let duration = 0;
    let mimeType = mime.getType(filename) || undefined;
    try {
      const result = await probe(filename);
      duration = result.format.duration;
      if (result.format.format_name.includes('mp4')) mimeType = 'video/mp4';
    } catch (_) {
      /* Probing is optional for non-media files. */
    }
    const buffer = stat.size < MAX_BYTES ? await read(filename) : undefined;
    if (!current()) throw new Error('Renderer changed');
    return { name: path.basename(filename), path: filename, mime: mimeType, duration, size: stat.size, buffer };
  });
  handle('open-content-file', async (filename, current) => {
    const stat = await fs.promises.stat(filename);
    // Unknown file types and executable files must be opened explicitly from
    // their folder; this API must not become a renderer process launcher.
    if (
      !OPEN_EXTENSIONS.has(path.extname(filename).toLowerCase()) ||
      (process.platform !== 'win32' && stat.mode & 0o111)
    )
      { return 'Open this file from its folder.' }
    if (!current()) throw new Error('Renderer changed');
    return shell.openPath(filename);
  });
  handle('reveal-content-file', (filename) => shell.showItemInFolder(filename));
  ipcMain.handle('save-post', async (event, text) => {
    const window = getWindow();
    if (!allowed(event, window) || typeof text !== 'string' || Buffer.byteLength(text) > 16 * 1024 * 1024) {
      throw new Error('Invalid post');
    }
    // The renderer supplies content only; it cannot choose a write destination.
    const directory = await fs.promises.mkdtemp(path.join(profile.temp, 'post-'));
    if (!allowed(event, window)) throw new Error('Renderer changed');
    const filename = path.join(directory, 'post.md');
    await fs.promises.writeFile(filename, text, { flag: 'wx', mode: 0o600 });
    await grant(filename);
    return filename;
  });
  return { grant };
}

module.exports = { registerContentFiles };
