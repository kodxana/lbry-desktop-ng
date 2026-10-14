/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { mock } = require('node:test');
const { getDiskSpace } = require('../electron/diskSpace.cjs');

async function diskTests() {
  const runs = path.resolve(__dirname, '../dist/setup-tests');
  fs.mkdirSync(runs, { recursive: true });
  const directory = fs.mkdtempSync(path.join(runs, "disk ł ' $(); & "));
  const link = directory + '-link';
  try {
    const result = await getDiskSpace(directory);
    assert(result.total > 4 * 1024 * 1024, 'Capacity must not truncate to 32-bit bytes');
    assert(Number.isSafeInteger(result.free) && result.free >= 0 && result.free <= result.total);
    const parent = await getDiskSpace(runs);
    assert.equal(result.total, parent.total);
    assert(Math.abs(result.free - parent.free) < 1024 * 1024);
    fs.symlinkSync(directory, link, process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal((await getDiskSpace(link)).total, result.total);
    await assert.rejects(getDiskSpace(path.join(directory, 'missing')), { code: 'ENOENT' });
    await assert.rejects(getDiskSpace(__filename), /not a directory/);
  } finally {
    if (fs.existsSync(link)) fs.unlinkSync(link);
    fs.rmdirSync(directory);
  }
  console.log(
    'PASS: native disk capacity, Unicode/metacharacter paths, directory links and missing/non-directory paths'
  );

  const stats = { bsize: 4096n, frsize: 4096n, blocks: 268435456n, bfree: 200000000n, bavail: 67108864n };
  try {
    mock.method(fs.promises, 'realpath', async () => '/resolved/storage');
    mock.method(fs.promises, 'stat', async () => ({ isDirectory: () => true }));
    const query = mock.method(fs.promises, 'statfs', async (resolved, options) => {
      assert.equal(resolved, '/resolved/storage');
      assert.deepEqual(options, { bigint: true });
      return stats;
    });
    assert.deepEqual(await getDiskSpace('storage'), { total: 1073741824, free: 268435456 });
    for (const available of [0n, -1n]) {
      query.mock.mockImplementation(async () => ({ ...stats, bavail: available }));
      assert.deepEqual(await getDiskSpace('storage'), { total: 1073741824, free: 0 });
    }
    // Fundamental allocation units, not transfer size, determine disk capacity.
    query.mock.mockImplementation(async () => ({ ...stats, frsize: 512n, blocks: 5n, bavail: 3n }));
    assert.deepEqual(await getDiskSpace('storage'), { total: 2, free: 1 });
    query.mock.mockImplementation(async () => ({ ...stats, frsize: 0n }));
    assert.deepEqual(await getDiskSpace('storage'), { total: 1073741824, free: 268435456 });
    // Bytes exceed Number's exact range, but the resulting KiB still fit safely.
    query.mock.mockImplementation(async () => ({ ...stats, blocks: 9007199254740991n, frsize: 512n, bavail: 1n }));
    assert.deepEqual(await getDiskSpace('storage'), { total: 4503599627370495, free: 0 });
    for (const invalid of [
      { blocks: 0n },
      { blocks: -1n },
      { frsize: -1n },
      { frsize: 0n, bsize: 0n },
      { bavail: stats.blocks + 1n },
      { blocks: 9007199254740991n },
    ]) {
      query.mock.mockImplementation(async () => ({ ...stats, ...invalid }));
      await assert.rejects(getDiskSpace('storage'), /Invalid disk space/);
    }
    for (const code of ['EACCES', 'EIO', 'ENOENT']) {
      query.mock.mockImplementation(async () => {
        throw Object.assign(new Error(code), { code });
      });
      await assert.rejects(getDiskSpace('storage'), { code });
    }
    console.log(
      'PASS: caller-available space, full/reserved blocks, allocation units, precise KiB and filesystem errors'
    );

    mock.timers.enable({ apis: ['setTimeout'] });
    for (const operation of ['realpath', 'stat', 'statfs']) {
      const pending = Promise.withResolvers();
      const started = Promise.withResolvers();
      const stalled = mock.method(fs.promises, operation, () => {
        started.resolve();
        return pending.promise;
      });
      const check = getDiskSpace('storage');
      const rejected = assert.rejects(check, /Storage check timed out/);
      await started.promise;
      mock.timers.tick(10000);
      await rejected;
      pending.reject(new Error('Late filesystem failure'));
      await new Promise((resolve) => setImmediate(resolve));
      stalled.mock.restore();
    }
    query.mock.mockImplementation(async () => stats);
    assert.deepEqual(await getDiskSpace('storage'), { total: 1073741824, free: 268435456 });
    mock.timers.tick(10000);
    console.log('PASS: stalled filesystem queries time out, late failures are handled and retries can succeed');
  } finally {
    mock.restoreAll();
    mock.timers.reset();
  }
}

module.exports = diskTests;
