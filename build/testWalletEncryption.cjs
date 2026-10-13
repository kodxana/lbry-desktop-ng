const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const Daemon = require('../electron/Daemon.cjs');
const { createProfile } = require('../electron/testProfile.cjs');
const { registerWalletBackup } = require('../electron/walletBackup.cjs');

// Called only with the disposable regtest profile owned by testSdkIsolation.
module.exports = async function testWalletEncryption(profile, binary, waitForHistory, addresses) {
  const walletPath = path.join(profile.wallet, 'wallets/default_wallet');
  const original = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const password = 'Disposable regression password ł';
  let archive;
  async function withDaemon(target, check) {
    const daemon = new Daemon(target, binary);
    try {
      await daemon.launch();
      await waitForHistory(daemon);
      await check(daemon);
      await daemon.quitForUpdate();
      assert.equal((await daemon.exited).code, 0);
    } finally {
      await daemon.quit();
    }
  }
  async function status(daemon, encrypted, locked) {
    const result = await daemon.rpc('wallet_status');
    assert.equal(result.is_encrypted, encrypted);
    assert.equal(result.is_locked, locked);
    assert.equal((await daemon.rpc('wallet_balance')).total, '0.0');
    assert.deepEqual((await daemon.rpc('address_list')).items.map((item) => item.address).sort(), addresses);
  }
  await withDaemon(profile, async (daemon) => {
    await status(daemon, false, false);
    await assert.rejects(daemon.rpc('wallet_encrypt', { new_password: '' }), /blank password/);
    await status(daemon, false, false);
    assert.equal(await daemon.rpc('wallet_encrypt', { new_password: password }), true);
    await status(daemon, true, false);
    const encrypted = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
    for (let index = 0; index < original.accounts.length; index++) {
      assert.equal(encrypted.accounts[index].encrypted, true);
      assert(encrypted.accounts[index].seed !== original.accounts[index].seed, 'Seed must be encrypted on disk');
      assert(
        encrypted.accounts[index].private_key !== original.accounts[index].private_key,
        'Private key must be encrypted on disk'
      );
    }
    assert.equal(await daemon.rpc('wallet_lock'), true);
    await status(daemon, true, true);
    assert.equal(await daemon.rpc('wallet_unlock', { password: 'wrong fixture password' }), false);
    await status(daemon, true, true);
    await assert.rejects(daemon.rpc('wallet_decrypt'), /locked wallet/);
    assert.equal(await daemon.rpc('wallet_unlock', { password }), true);
    await status(daemon, true, false);
    const frame = { url: 'file:///backup-fixture/index.html' };
    const window = { isDestroyed: () => false, webContents: { mainFrame: frame, isDestroyed: () => false } };
    let backup;
    registerWalletBackup({
      ipcMain: {
        on: () => {},
        handle: (name, handler) => {
          if (name === 'wallet-backup') backup = handler;
        },
      },
      app: { getPath: () => profile.downloads },
      shell: { showItemInFolder: () => {} },
      rpc: (method, params) => daemon.rpc(method, params),
      getWindow: () => window,
      rendererURL: frame.url,
    });
    const result = await backup(
      { sender: window.webContents, senderFrame: frame },
      {
        id: 'encrypted-wallet-fixture',
        directory: profile.wallet,
      }
    );
    assert.equal(result.ok, true, 'The main-process backup must work against the running SDK');
    archive = result.path;
    assert(new AdmZip(archive).readFile('wallets/default_wallet').equals(fs.readFileSync(walletPath)));
  });

  // Restore the archive produced by the desktop service only into a new test
  // profile, while both SDKs are stopped.
  await withDaemon(profile, async (daemon) => {
    await status(daemon, true, true);
    assert.equal(await daemon.rpc('wallet_unlock', { password }), true);
    assert.equal(await daemon.rpc('wallet_decrypt'), true);
    await status(daemon, false, false);
  });

  const restored = createProfile(fs.mkdtempSync(path.join(path.dirname(profile.root), 'restored-wallet-')));
  fs.copyFileSync(profile.config, restored.config);
  new AdmZip(archive).extractAllTo(restored.wallet, false);
  await withDaemon(restored, async (daemon) => {
    await status(daemon, true, true);
    assert.equal(await daemon.rpc('wallet_unlock', { password: 'wrong fixture password' }), false);
    assert.equal(await daemon.rpc('wallet_unlock', { password }), true);
    await status(daemon, true, false);
    assert.equal(await daemon.rpc('wallet_decrypt'), true);
    await status(daemon, false, false);
  });
  await withDaemon(restored, async (daemon) => {
    await status(daemon, false, false);
    const recovered = JSON.parse(fs.readFileSync(path.join(restored.wallet, 'wallets/default_wallet'), 'utf8'));
    for (let index = 0; index < original.accounts.length; index++) {
      // Boolean assertions keep generated keys out of CI output even on failure.
      assert(recovered.accounts[index].seed === original.accounts[index].seed, 'Restored seed must be unchanged');
      assert(
        recovered.accounts[index].private_key === original.accounts[index].private_key,
        'Restored key must be unchanged'
      );
    }
  });
  const log = fs.readFileSync(path.join(restored.logs, 'daemon-console.log'), 'utf8');
  assert.equal((log.match(/finished shutting down/g) || []).length, 2);
  assert(!log.includes('Task was destroyed but it is pending!'));
  console.log(
    'PASS: real SDK encrypt/lock/wrong-password/unlock, encrypted backup restore and decrypt survive restart without changing keys or addresses'
  );
};
