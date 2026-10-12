import { strict as assert } from 'assert';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { shell } from 'electron';
import * as remote from '@electron/remote';
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
  const downloads = remote.app.getPath('downloads');
  const revealed = [];
  const reveal = shell.showItemInFolder;
  shell.showItemInFolder = (value) => revealed.push(value);
  const drawBackup = (directory) => render(<WalletBackup daemonSettings={{ wallet_dir: directory }} />, store, history);
  const backup = () =>
    Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent === 'Create Backup')
      .click();
  try {
    drawBackup(walletDir);
    backup();
    assert.equal(revealed.length, 1);
    const archive = revealed[0];
    assert.equal(path.dirname(archive), downloads);
    assert(!path.basename(archive).includes(':'), 'Backup filename must work on Windows');
    const zip = new AdmZip(archive);
    assert.deepEqual(zip.readFile('wallets/default_wallet'), bytes, 'Wallet bytes must round-trip unchanged');
    assert(zip.getEntry('preferences.json'));
    assert.equal(zip.getEntries().filter((entry) => !entry.isDirectory).length, 2);
    assert(document.querySelector('.card__message--success').textContent.includes(archive));
    drawBackup(undefined);
    backup();
    assert(document.body.textContent.includes('No wallet folder was found'));
    assert.equal(document.querySelector('.card__message--success').textContent, '');
    drawBackup(path.join(root, 'missing-wallet'));
    backup();
    assert(document.body.textContent.includes('could not be added'));
    assert.equal(revealed.length, 1, 'Failure must not report or reveal a backup');
    // A file at the destination directory gives a deterministic write failure even as root.
    const blocked = path.join(root, 'not-a-directory');
    fs.writeFileSync(blocked, 'fixture');
    remote.app.setPath('downloads', blocked);
    drawBackup(walletDir);
    backup();
    assert(document.body.textContent.includes('problem writing'));
    assert.equal(revealed.length, 1);
  } finally {
    remote.app.setPath('downloads', downloads);
    shell.showItemInFolder = reveal;
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
        await pending;
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
  const encryptProps = {
    closeModal: () => {
      closed++;
    },
    updateWalletStatus: () => {
      refreshed++;
    },
    encryptWallet: (value) => submitted.push(value),
  };
  const drawEncrypt = (result) => render(<Encrypt {...encryptProps} walletEncryptSucceded={result} />, store, history);
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
  assert(document.body.textContent.includes('Unable to encrypt wallet'));
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
  let exited = 0;
  const unlockProps = {
    unlockWallet: (value) => attempts.push(value),
    closeModal: () => {
      closed++;
    },
    quit: () => {
      exited++;
    },
  };
  const drawUnlock = (result) => render(<Unlock {...unlockProps} walletUnlockSucceded={result} />, store, history);
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
  assert(document.body.textContent.includes('Incorrect Password'));
  input('wallet-password', 'retry-password');
  submit();
  assert.equal(attempts[1], 'retry-password');
  input('wallet-password', 'edited-during-unlock');
  assert.equal(closed, 1, 'Wrong password must keep the modal open');
  drawUnlock(null);
  drawUnlock(true);
  await tick();
  assert.equal(closed, 2);
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
