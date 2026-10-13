/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { registerWalletBackup } = require('../electron/walletBackup.cjs');
const readBackup = require('./tests/readBackup.cjs');
const legacyDirectory = path.join(__dirname, 'tests/fixtures/wallet-backup');
const legacy = require('./tests/fixtures/wallet-backup/manifest.json');
const output = path.resolve(__dirname, '../dist/backup-tests');
fs.mkdirSync(output, { recursive: true });

function testLegacyBackup() {
  const bytes = fs.readFileSync(path.join(legacyDirectory, 'adm-zip-0.4.16.zip'));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), legacy.sha256);
  const zip = new AdmZip(bytes);
  assert.deepEqual(
    zip
      .getEntries()
      .map((entry) => entry.entryName)
      .sort(),
    [...legacy.directories, ...Object.keys(legacy.files)].sort()
  );
  const restored = fs.mkdtempSync(path.join(output, 'legacy-'));
  zip.extractAllTo(restored, false);
  for (const directory of legacy.directories) {
    assert(zip.getEntry(directory).isDirectory);
    assert(fs.statSync(path.join(restored, directory)).isDirectory());
  }
  for (const [name, base64] of Object.entries(legacy.files)) {
    const expected = Buffer.from(base64, 'base64');
    assert.deepEqual(zip.readFile(name), expected, name);
    assert.deepEqual(fs.readFileSync(path.join(restored, name)), expected, name);
  }
}

function fixture(filesystem = fs) {
  const root = fs.mkdtempSync(path.join(output, 'wallet-'));
  const wallet = path.join(root, 'wallet ł');
  const downloads = path.join(root, 'downloads');
  fs.mkdirSync(wallet);
  fs.mkdirSync(path.join(wallet, 'empty'));
  fs.mkdirSync(downloads);
  const bytes = Buffer.from('{"encrypted":"synthetic ciphertext"}\n');
  fs.writeFileSync(path.join(wallet, 'default_wallet'), bytes);
  const handlers = {};
  const frame = { url: 'file:///fixture/index.html' };
  const window = { isDestroyed: () => false, webContents: { isDestroyed: () => false, mainFrame: frame } };
  const event = { sender: window.webContents, senderFrame: frame };
  const state = { root, wallet, downloads, bytes, event, window, revealed: [], rpcCalls: 0 };
  registerWalletBackup({
    filesystem,
    ipcMain: {
      handle: (channel, fn) => {
        handlers[channel] = fn;
      },
      on: (channel, fn) => {
        handlers[channel] = fn;
      },
    },
    app: {
      getPath: (name) => {
        if (state.noPaths) throw new Error('Unavailable');
        return name === 'downloads' ? state.downloads : root;
      },
    },
    shell: {
      showItemInFolder: (name) => state.revealed.push(name),
      openPath: async (name) => {
        state.opened = name;
        return '';
      },
    },
    rpc: async (method) => {
      assert.equal(method, 'settings_get');
      state.rpcCalls++;
      if (state.hold) {
        await new Promise((resolve) => {
          state.release = resolve;
        });
      }
      return { wallet_dir: state.wallet };
    },
    getWindow: () => window,
    rendererURL: frame.url,
  });
  state.backup = (request = { id: 'fixture', directory: state.wallet }, sender = event) =>
    handlers['wallet-backup'](sender, request);
  state.cancel = () => handlers['wallet-backup-cancel'](event, 'fixture');
  state.open = () => handlers['wallet-folder'](event);
  return state;
}

async function main() {
  testLegacyBackup();
  const f = fixture();
  for (const directory of legacy.directories) {
    fs.mkdirSync(path.join(f.wallet, directory), { recursive: true });
  }
  for (const [name, base64] of Object.entries(legacy.files)) {
    fs.writeFileSync(path.join(f.wallet, name), Buffer.from(base64, 'base64'));
  }
  for (const request of [null, {}, { id: {}, directory: f.wallet }, { id: 'fixture', directory: '../wallet' }]) {
    assert.equal((await f.backup(request)).ok, false);
  }
  assert.equal(
    (await f.backup(undefined, { ...f.event, senderFrame: { url: f.event.senderFrame.url } })).error,
    'sender'
  );
  assert.equal(f.rpcCalls, 0, 'Invalid and subframe requests must not contact the wallet');
  assert.equal((await f.backup({ id: 'fixture', directory: f.root })).error, 'wallet');
  assert.equal(f.revealed.length, 0, 'Renderer cannot choose another source directory');
  const result = await f.backup();
  assert.equal(result.ok, true);
  assert.equal(path.dirname(result.path), f.downloads);
  assert.deepEqual(new AdmZip(result.path).readFile('default_wallet'), f.bytes);
  assert.equal(new AdmZip(result.path).getEntry('empty/').isDirectory, true);
  const contents = await readBackup(result.path);
  assert.deepEqual(
    [...contents.keys()].sort(),
    [...legacy.directories, ...Object.keys(legacy.files), 'default_wallet'].sort()
  );
  assert.deepEqual(contents.get('default_wallet'), f.bytes);
  for (const directory of legacy.directories) {
    assert.equal(contents.get(directory), null);
  }
  for (const [name, base64] of Object.entries(legacy.files)) {
    const expected = Buffer.from(base64, 'base64');
    assert.deepEqual(contents.get(name), expected, name);
    assert.deepEqual(fs.readFileSync(path.join(f.wallet, name)), expected, 'Backup must not modify its source');
  }
  assert.deepEqual(fs.readFileSync(path.join(f.wallet, 'default_wallet')), f.bytes);
  assert.deepEqual(f.revealed, [result.path]);
  await f.open();
  assert.equal(f.opened, f.wallet);
  f.noPaths = true;
  const fallback = await f.backup();
  assert.equal(fallback.ok, true);
  assert.equal(path.dirname(fallback.path), f.root);
  f.noPaths = false;
  f.downloads = path.join(f.wallet, 'default_wallet');
  assert.equal((await f.backup()).error, 'write');
  assert.deepEqual(fs.readFileSync(path.join(f.wallet, 'default_wallet')), f.bytes);

  for (const invalidate of [
    (s) => s.cancel(),
    (s) => {
      s.event.senderFrame.url = 'https://example.invalid';
    },
    (s) => {
      s.window.isDestroyed = () => true;
    },
  ]) {
    const s = fixture();
    s.hold = true;
    const pending = s.backup();
    assert.equal((await s.backup()).error, 'busy');
    invalidate(s);
    s.release();
    assert.equal((await pending).ok, false);
    assert.equal(fs.readdirSync(s.downloads).length, 0, 'Canceled or stale requests must not create backups');
  }
  const missing = fixture();
  missing.wallet = path.join(missing.root, 'missing');
  assert.equal((await missing.backup()).error, 'archive');
  const linked = fixture();
  const elsewhere = path.join(linked.root, 'outside');
  fs.mkdirSync(elsewhere);
  fs.writeFileSync(path.join(elsewhere, 'private'), 'Do not include');
  fs.symlinkSync(elsewhere, path.join(linked.wallet, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await linked.backup()).error, 'archive');
  assert.equal(fs.readdirSync(linked.downloads).length, 0);
  const partial = fixture({
    ...fs,
    writeFileSync: (fd) => {
      fs.writeSync(fd, 'partial ZIP');
      throw new Error('Synthetic disk full');
    },
  });
  assert.equal((await partial.backup()).error, 'write');
  assert.equal(fs.readdirSync(partial.downloads).length, 0, 'Remove only the partial archive created by this request');
  let collision;
  const existing = fixture({
    ...fs,
    openSync: (file, flags, mode) => {
      collision = file;
      fs.writeFileSync(file, 'existing backup');
      return fs.openSync(file, flags, mode);
    },
  });
  assert.equal((await existing.backup()).error, 'write');
  assert.equal(fs.readFileSync(collision, 'utf8'), 'existing backup', 'Never overwrite or remove an older backup');
  console.log(
    'PASS: legacy wallet ZIP restore, independent backup reader, unchanged bytes, destinations, failures, cancellation and sender checks'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
