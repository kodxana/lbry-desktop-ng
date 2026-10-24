import { strict as assert } from 'assert';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { ipcRenderer } from 'electron';

import AdmZip from 'adm-zip';
import Lbry from 'lbry';
import * as actions from 'redux/actions/wallet';
import WalletBackup from 'component/walletBackup/view';
import Encrypt from 'modal/modalWalletEncrypt/view';
import Unlock from 'modal/modalWalletUnlock/view';
import { getSavedPassword, setSavedPassword } from 'util/saved-passwords';
import { render, unmount, waitFor, tick, input, submit } from './helpers';

export default async function wallet(store, history, root) {
  const walletDir = path.join(root, 'synthetic-wallet ł');
  fs.mkdirSync(path.join(walletDir, 'wallets'), { recursive: true });
  const bytes = Buffer.from('{"fixture":"not a real wallet"}\n');
  fs.writeFileSync(path.join(walletDir, 'wallets', 'default_wallet'), bytes);
  fs.writeFileSync(path.join(walletDir, 'preferences.json'), '{}');
  let revealed = [];
  const fixture = async (mode, directory) => {
    const result = await ipcRenderer.invoke('fixture-desktop-info', mode, directory);
    revealed = result.revealed;
    return result;
  };
  const waitForBackups = (count, message) =>
    waitFor(async () => {
      await fixture();
      return revealed.length === count;
    }, message);
  const { downloads, home } = await fixture('downloads');
  const drawBackup = (directory) => render(<WalletBackup daemonSettings={{ wallet_dir: directory }} />, store, history);
  const backup = () =>
    Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent === 'Create Backup')
      .click();
  try {
    drawBackup(walletDir);
    backup();
    await waitForBackups(1, 'Backup did not finish');
    const archive = revealed[0];
    assert.equal(path.dirname(archive), downloads);
    assert(!path.basename(archive).includes(':'), 'Backup filename must work on Windows');
    const zip = new AdmZip(archive);
    assert.deepEqual(zip.readFile('wallets/default_wallet'), bytes, 'Wallet bytes must round-trip unchanged');
    assert(zip.getEntry('preferences.json'));
    assert.equal(zip.getEntries().filter((entry) => !entry.isDirectory).length, 2);
    await waitFor(
      () => document.querySelector('.card__message--success').textContent.includes(archive),
      'The finished backup must display its archive path'
    );
    drawBackup(undefined);
    backup();
    await waitFor(
      () => document.body.textContent.includes('No wallet folder was found'),
      'A missing wallet folder must report an error'
    );
    assert.equal(document.querySelector('.card__message--success').textContent, '');
    drawBackup(path.join(root, 'missing-wallet'));
    await fixture('downloads', path.join(root, 'missing-wallet'));
    backup();
    await waitFor(
      () => document.body.textContent.includes('could not be added'),
      'Missing source must report an error'
    );
    assert.equal(revealed.length, 1, 'Failure must not report or reveal a backup');
    // A file at the destination gives a deterministic write failure, even as root.
    await fixture('blocked', walletDir);
    drawBackup(walletDir);
    backup();
    await waitFor(
      () => document.body.textContent.includes('problem writing'),
      'Unwritable destination must report an error'
    );
    assert.equal(revealed.length, 1);
    for (const [mode, directory] of [
      ['home', home],
      ['missing', root],
    ]) {
      await fixture(mode);
      drawBackup(walletDir);
      const before = revealed.length;
      backup();
      await waitForBackups(before + 1, 'Backup fallback did not finish');
      const archive = revealed[before];
      assert.equal(path.dirname(archive), directory);
      assert.deepEqual(new AdmZip(archive).readFile('wallets/default_wallet'), bytes);
    }
    const before = revealed.length;
    await fixture('reject');
    drawBackup(walletDir);
    backup();
    await waitFor(
      () => document.body.textContent.includes('could not be determined'),
      'IPC failure must report an error'
    );
    assert.equal(revealed.length, before);
    await fixture('hold');
    backup();
    await waitFor(async () => (await fixture()).pending, 'Expected a pending path lookup');
    const calls = (await fixture()).calls;
    backup();
    assert.equal((await fixture()).calls, calls, 'Repeated clicks must not start overlapping backups');
    await fixture('release');
    await waitForBackups(before + 1, 'Failed lookup must remain retryable');
    for (const leave of [() => unmount(), () => drawBackup(path.join(root, 'different-wallet'))]) {
      await fixture('hold');
      drawBackup(walletDir);
      backup();
      await waitFor(async () => (await fixture()).pending, 'Expected a held backup');
      leave();
      await fixture('release');
      await tick();
      await fixture();
      assert.equal(revealed.length, before + 1, 'Leaving or switching wallets must discard a pending backup');
    }
  } finally {
    await fixture('downloads');
    unmount();
  }

  // Keep reducers and actions real; replace only the SDK transport boundary.
  for (const [name, action, field, params] of [
    ['wallet_encrypt', actions.doWalletEncrypt, 'walletEncrypt', { new_password: 'fixture-password' }],
    ['wallet_unlock', actions.doWalletUnlock, 'walletUnlock', { password: 'fixture-password' }],
    ['wallet_lock', actions.doWalletLock, 'walletLock', undefined],
    ['wallet_decrypt', actions.doWalletDecrypt, 'walletDecrypt', undefined],
  ]) {
    const original = Lbry[name];
    try {
      for (const outcome of [true, false, 'reject']) {
        let settle;
        Lbry[name] = (received) => {
          assert.deepEqual(received, params);
          return new Promise((resolve, reject) => {
            settle = () => (outcome === 'reject' ? reject(new Error('Synthetic RPC failure')) : resolve(outcome));
          });
        };
        const pending = store.dispatch(action('fixture-password'));
        assert.equal(store.getState().wallet[field + 'Pending'], true, name + ' must enter pending state');
        assert.equal(store.getState().wallet[field + 'Succeded'], null);
        assert(pending && typeof pending.then === 'function', name + ' must expose completion');
        settle();
        const succeeded = await pending;
        if (name === 'wallet_encrypt' || name === 'wallet_unlock') assert.equal(succeeded, outcome === true);
        assert.equal(store.getState().wallet[field + 'Pending'], false, name + ' must clear pending after errors');
        assert.equal(store.getState().wallet[field + 'Succeded'], outcome === true);
      }
    } finally {
      delete Lbry[name];
      assert.equal(typeof original, 'function');
    }
  }

  let closed = 0;
  let refreshed = 0;
  const submitted = [];
  let settleEncrypt;
  const encryptProps = {
    closeModal: () => {
      closed++;
    },
    updateWalletStatus: () => {
      refreshed++;
    },
    encryptWallet: (value) => {
      submitted.push(value);
      return new Promise((resolve) => {
        settleEncrypt = resolve;
      });
    },
  };
  const drawEncrypt = (result) => {
    render(<Encrypt {...encryptProps} />, store, history);
    if (typeof result === 'boolean' && settleEncrypt) {
      settleEncrypt(result);
      settleEncrypt = null;
    }
  };
  drawEncrypt(undefined);
  assert.equal(document.getElementById('wallet-remember-password').checked, false);
  submit();
  assert.equal(submitted.length, 0);
  input('wallet-new-password', 'fixture-password');
  input('wallet-new-password-confirm', 'different');
  submit();
  assert(document.body.textContent.includes('Passwords do not match'));
  assert.equal(submitted.length, 0);
  input('wallet-new-password-confirm', 'fixture-password');
  submit();
  assert.equal(submitted.length, 0, 'Acknowledgement is required');
  input('wallet-understand', 'I Understand');
  submit();
  assert.deepEqual(submitted, ['fixture-password']);
  submit();
  assert.equal(submitted.length, 1, 'Pending encryption must not be submitted twice');
  assert.equal(await getSavedPassword(), null, 'Do not save a password before encryption succeeds');
  drawEncrypt(false);
  await waitFor(
    () => document.body.textContent.includes('Unable to encrypt wallet'),
    'Encryption failure must be retryable'
  );
  assert.equal(closed, 0);
  assert.equal(await getSavedPassword(), null, 'Failed encryption must not cache the attempted password');
  submit();
  drawEncrypt(null);
  input('wallet-new-password', 'edited-after-submit');
  drawEncrypt(true);
  await waitFor(() => closed === 1, 'Successful encryption must close its modal');
  assert.equal(refreshed, 1);
  assert.equal(await getSavedPassword(), 'fixture-password');
  assert(!document.cookie.includes('saved_password'), 'Remember password is opt-in');
  unmount();

  const attempts = [];
  let settleUnlock;
  let exited = 0;
  const unlockProps = {
    unlockWallet: (value) => {
      attempts.push(value);
      return new Promise((resolve) => {
        settleUnlock = resolve;
      });
    },
    closeModal: () => {
      closed++;
    },
    quit: () => {
      exited++;
    },
  };
  const drawUnlock = (result) => {
    render(<Unlock {...unlockProps} walletUnlockSucceded={result} />, store, history);
    if (typeof result === 'boolean' && settleUnlock) {
      settleUnlock(result);
      settleUnlock = null;
    }
  };
  drawUnlock(true);
  await waitFor(() => attempts.length === 1, 'Session password should be tried on unlock');
  assert.equal(attempts[0], 'fixture-password');
  assert.equal(
    document.getElementById('wallet-remember-password').checked,
    false,
    'A session password must not opt into disk storage'
  );
  assert.equal(closed, 1, 'A previous unlock result must not close a new attempt');
  drawUnlock(false);
  await tick();
  assert(document.body.textContent.includes('Incorrect Password'));
  input('wallet-password', 'retry-password');
  submit();
  assert.equal(attempts[1], 'retry-password');
  input('wallet-password', 'edited-during-unlock');
  assert.equal(closed, 1, 'Wrong password must keep the modal open');
  drawUnlock(null);
  drawUnlock(true);
  await waitFor(() => closed === 2, 'Successful unlock must close after password storage finishes');
  assert.equal(await getSavedPassword(), 'retry-password');
  let saved = false;
  setSavedPassword('retry-password', false).then(() => {
    saved = true;
  });
  await waitFor(() => saved, 'Saving a session password must settle its promise');
  unmount();
  drawUnlock(null);
  await tick();
  Array.from(document.querySelectorAll('button'))
    .find((button) => button.textContent === 'Exit')
    .click();
  assert.equal(exited, 1);
  unmount();
  return 'wallet backup ZIP round-trip/errors, encrypt/unlock/lock/decrypt RPC failures and password modal validation/retry';
}
