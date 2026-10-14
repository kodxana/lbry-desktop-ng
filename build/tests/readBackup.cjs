const assert = require('assert').strict;
const { buffer } = require('stream/consumers');
const yauzl = require('yauzl');

// Validate new backups with a reader independent of the production ZIP writer.
module.exports = async function readBackup(filename) {
  const zip = await yauzl.openPromise(filename, { strictFileNames: true });
  const contents = new Map();
  try {
    for await (const entry of zip.eachEntry()) {
      assert(!contents.has(entry.fileName), 'Backup entries must have distinct paths');
      const bytes = entry.fileName.endsWith('/') ? null : await buffer(await zip.openReadStreamPromise(entry));
      contents.set(entry.fileName, bytes);
    }
    return contents;
  } finally {
    zip.close();
  }
};
