const fs = require('fs');
const path = require('path');
const mime = require('mime');

async function getFileFromPath(_event, filePath, readContents = true) {
  const stats = await fs.promises.stat(filePath);
  const name = path.basename(filePath);
  return {
    name,
    path: filePath,
    mime: stats.isDirectory() ? undefined : mime.getType(name) || undefined,
    buffer: stats.isDirectory() || !readContents ? new ArrayBuffer(0) : await fs.promises.readFile(filePath),
  };
}

module.exports = { getFileFromPath };
