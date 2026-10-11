const crypto = require('crypto');
const fs = require('fs');
const candidate = require('./sdk-candidate.json');

function artifactFor(platform = process.platform, arch = process.arch) {
  if (arch !== 'x64' || !candidate.artifacts[platform]) {
    throw new Error('This SDK candidate supports Windows, Linux and Intel macOS x64 only.');
  }
  return candidate.artifacts[platform];
}

function verifiedBytes(filename, expectedHash) {
  const bytes = fs.readFileSync(filename);
  const actual = crypto.createHash('sha256').update(bytes).digest('hex');
  if (actual !== expectedHash) throw new Error('SDK SHA-256 mismatch: ' + filename);
  return bytes;
}

function stageBinary(source, destination, expectedHash) {
  const bytes = verifiedBytes(source, expectedHash);
  const temporary = destination + '.partial-' + process.pid;
  try {
    fs.writeFileSync(temporary, bytes, { flag: 'wx', mode: 0o755 });
    fs.renameSync(temporary, destination);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

module.exports = { artifactFor, verifiedBytes, stageBinary };
