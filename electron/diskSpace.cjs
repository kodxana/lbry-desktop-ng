const fs = require('fs');

async function readDiskSpace(directory) {
  const resolved = await fs.promises.realpath(directory);
  if (!(await fs.promises.stat(resolved)).isDirectory()) throw new Error('Storage path is not a directory.');
  const stats = await fs.promises.statfs(resolved, { bigint: true });
  // Filesystem allocation units can differ from the optimal transfer block size.
  const blockSize = stats.frsize || stats.bsize;
  if (blockSize <= 0n || stats.blocks <= 0n || stats.bavail > stats.blocks) {
    throw new Error('Invalid disk space information.');
  }
  // Use caller-available blocks (quotas/reserved space), in the UI's existing KiB units.
  const total = Number((stats.blocks * blockSize) / 1024n);
  const free = Number(((stats.bavail < 0n ? 0n : stats.bavail) * blockSize) / 1024n);
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(free) || total <= 0 || free > total) {
    throw new Error('Invalid disk space information.');
  }
  return { total, free };
}

async function getDiskSpace(directory) {
  let timer;
  try {
    return await Promise.race([
      readDiskSpace(directory),
      new Promise((resolve, reject) => {
        // A stalled filesystem request cannot be cancelled, but setup must still receive an error.
        timer = setTimeout(() => reject(new Error('Storage check timed out.')), 10000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { getDiskSpace };
