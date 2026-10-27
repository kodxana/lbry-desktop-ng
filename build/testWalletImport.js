/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const { openProfiles, readSetup } = require('../electron/walletProfiles.cjs');
const { readSelection, registerWalletImport } = require('../electron/walletImport.cjs');

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-import-'));
  try {
    const settings = { appId: 'test.wallet-import' };
    const base = path.join(root, 'ng');
    const profiles = openProfiles(base, settings);
    const wallets = path.join(profiles.current.wallet, 'wallets');
    fs.mkdirSync(wallets);
    const original = Buffer.from('{"existing":"wallet must not change"}\n');
    fs.writeFileSync(path.join(wallets, 'default_wallet'), original);
    const source = path.join(root, 'legacy-wallet');
    const imported = Buffer.from('{"fixture":"imported wallet"}\n');
    fs.writeFileSync(source, imported);
    assert.deepEqual(readSelection(source)[0].read(), imported);
    const backup = path.join(root, 'backup.zip');
    const zip = new AdmZip();
    zip.addFile('wallets/default_wallet', imported);
    zip.addFile('wallets/second-wallet', Buffer.from('second wallet'));
    zip.addFile('lbc_mainnet/blockchain.db', Buffer.from('must not import'));
    zip.writeZip(backup);
    const entries = readSelection(backup);
    assert.equal(entries.length, 2);
    assert.deepEqual(entries.find((entry) => entry.name.endsWith('default_wallet')).read(), imported);
    const single = new AdmZip();
    single.addFile('wallets/default_wallet', imported);
    const corrupt = Buffer.from(single.toBuffer());
    const central = corrupt.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    corrupt.writeUInt32LE((corrupt.readUInt32LE(central + 16) ^ 1) >>> 0, central + 16);
    fs.writeFileSync(path.join(root, 'corrupt.zip'), corrupt);
    assert.throws(() => readSelection(path.join(root, 'corrupt.zip'))[0].read(), /integrity/);
    const traversal = new AdmZip();
    traversal.addFile('safe/wallets/default_wallet', imported);
    const traversalBytes = Buffer.from(traversal.toBuffer());
    const safeName = Buffer.from('safe/wallets/default_wallet');
    for (let offset = traversalBytes.indexOf(safeName); offset !== -1; offset = traversalBytes.indexOf(safeName)) {
      traversalBytes.write('.././wallets/default_wallet', offset);
    }
    fs.writeFileSync(path.join(root, 'traversal.zip'), traversalBytes);
    assert.throws(() => readSelection(path.join(root, 'traversal.zip')), /No supported wallet/);
    const oversized = new AdmZip();
    oversized.addFile('wallets/default_wallet', Buffer.alloc(8 * 1024 * 1024 + 1));
    oversized.writeZip(path.join(root, 'oversized.zip'));
    assert.throws(() => readSelection(path.join(root, 'oversized.zip'))[0].read(), /too large/);
    fs.writeFileSync(path.join(root, 'empty'), '');
    assert.throws(() => readSelection(path.join(root, 'empty')));

    const handlers = new Map();
    let cancel = false;
    let trust = true;
    let settingsOnly = true;
    let sdkFailure = false;
    let stopFailure = false;
    const calls = [];
    const controller = registerWalletImport({
      ipcMain: {
        handle: (name, handler) => handlers.set(name, handler),
        on: (name, handler) => handlers.set(name, handler),
      },
      dialog: { showOpenDialog: async () => ({ canceled: cancel, filePaths: [source] }) },
      profiles,
      allowed: () => trust,
      getWindow: () => ({}),
      settingsOnly: () => settingsOnly,
      rpc: async (method, params) => {
        calls.push([method, params]);
        assert.equal(method, 'wallet_import_preview');
        const staged = path.join(profiles.current.data, 'wallet-import', params.file_name);
        assert.deepEqual(fs.readFileSync(staged), imported);
        if (sdkFailure) throw new Error('SDK unavailable');
        return params.password === 'fixture-password'
          ? { ok: true, accounts: 1, channels: 0, encrypted: true }
          : { ok: false, error: params.password ? 'password' : 'password-required' };
      },
      restart: async (activate) => {
        if (stopFailure) throw new Error('SDK did not stop');
        if (activate) activate();
      },
    });
    const request = (operation, value) => handlers.get('wallet-setup')({}, operation, value);
    assert(controller.pending());
    assert(controller.state().hasWallet);
    trust = false;
    await assert.rejects(request('choose'), /Unknown window/);
    const denied = {};
    handlers.get('wallet-cloud-sync-enabled')(denied);
    assert.equal(denied.returnValue, false);
    trust = true;
    settingsOnly = false;
    await assert.rejects(request('choose'), /Open wallet setup/);
    settingsOnly = true;
    cancel = true;
    assert.deepEqual(await request('choose'), { canceled: true });
    cancel = false;
    const chosen = await request('choose');
    assert.deepEqual(chosen, { choices: [{ id: '0', name: 'legacy-wallet' }] });
    assert(!JSON.stringify(chosen).includes(imported.toString()));
    await assert.rejects(request('preview', { id: source }), /Choose a wallet/);
    assert.equal((await request('preview', { id: '0' })).error, 'password-required');
    assert.equal((await request('preview', { id: '0', password: 'wrong' })).error, 'password');
    await assert.rejects(request('import', { confirmed: true }), /Check the selected/);
    sdkFailure = true;
    await assert.rejects(request('preview', { id: '0' }), /SDK unavailable/);
    assert.deepEqual(fs.readdirSync(path.join(profiles.current.data, 'wallet-import')), []);
    sdkFailure = false;
    assert((await request('preview', { id: '0', password: 'fixture-password' })).ok);
    await assert.rejects(request('import', { confirmed: false }), /Confirm/);
    // A later change to the source must not change the bytes the user already verified.
    fs.writeFileSync(source, 'changed after preview');
    stopFailure = true;
    await assert.rejects(request('import', { confirmed: true }), /did not stop/);
    assert.equal(openProfiles(base, settings).activeId, 'original');
    assert.deepEqual(fs.readFileSync(path.join(wallets, 'default_wallet')), original);
    stopFailure = false;
    assert.deepEqual(await request('import', { confirmed: true }), { restarting: true });
    const reopened = openProfiles(base, settings);
    assert.notEqual(reopened.activeId, 'original');
    assert.equal(readSetup(reopened.current).cloudSync, false);
    assert.deepEqual(fs.readFileSync(path.join(reopened.current.wallet, 'wallets', 'default_wallet')), imported);
    assert.deepEqual(fs.readFileSync(path.join(wallets, 'default_wallet')), original);
    assert.equal(fs.readFileSync(source, 'utf8'), 'changed after preview');
    const rename = fs.renameSync;
    fs.renameSync = (from, to) => {
      if (to === path.join(base, 'active-wallet-profile.json')) throw new Error('injected activation failure');
      return rename(from, to);
    };
    try {
      assert.throws(() => reopened.activate('original'), /activation failure/);
    } finally {
      fs.renameSync = rename;
    }
    assert.equal(openProfiles(base, settings).activeId, reopened.activeId);
    assert.equal(fs.readdirSync(base).filter((name) => name.endsWith('.tmp')).length, 0);
    const sync = fs.fsyncSync;
    fs.fsyncSync = () => {
      throw new Error('injected write failure');
    };
    try {
      assert.throws(() => reopened.prepare(imported), /write failure/);
    } finally {
      fs.fsyncSync = sync;
    }
    assert.equal(openProfiles(base, settings).activeId, reopened.activeId);
    assert.deepEqual(fs.readFileSync(path.join(wallets, 'default_wallet')), original);
    assert.throws(() => reopened.activate('../escape'), /Unknown/);
    reopened.activate('original');
    assert.equal(openProfiles(base, settings).activeId, 'original');
    const fresh = reopened.prepare(null);
    reopened.activate(fresh);
    const freshProfile = openProfiles(base, settings).current;
    assert.equal(readSetup(freshProfile).cloudSync, false);
    assert(!fs.existsSync(path.join(freshProfile.wallet, 'wallets', 'default_wallet')));
    const aliasId = reopened.prepare(null);
    const alias = path.join(base, 'profiles', aliasId, 'data');
    fs.rmdirSync(alias);
    fs.symlinkSync(profiles.current.data, alias, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => reopened.activate(aliasId), /not local/);
    fs.unlinkSync(alias);
    await request('keep');
    assert(!controller.pending());
    assert.equal(readSetup(profiles.current).cloudSync, true);
    await assert.rejects(request('import', { confirmed: true }), /Open wallet setup/);
    console.log(
      'PASS: wallet and ZIP import, encrypted preview, cancellation, source preservation, stopped-SDK activation, profile recovery and cloud policy'
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
