import { strict as assert } from 'assert';
import React from 'react';
import { ipcRenderer } from 'electron';
import { Lbryio } from 'lbryinc';
import Encrypt from 'modal/modalWalletEncrypt/view';
import Unlock from 'modal/modalWalletUnlock/view';
import Forget from 'modal/modalPasswordUnsave/view';
import SyncPassword from 'component/syncPassword/view';
import { doSignOut } from 'redux/actions/app';
import {
  getSavedPassword,
  getSavedPasswordState,
  setSavedPassword,
  deleteSavedPassword,
  doSignOutCleanup,
  getAuthToken,
  setAuthToken,
} from 'util/saved-passwords';
import { render, unmount, waitFor, tick, input, submit } from './helpers';

const control = (operation) => ipcRenderer.invoke('test-password-storage', operation);
const click = (label) =>
  Array.from(document.querySelectorAll('button'))
    .find((button) => button.textContent === label)
    .click();

export default async function passwords(store, history) {
  await control('reset');
  // Use the production Electron cookie shim, including a host-only cookie and a
  // path/domain variant. The auth token must survive password migration.
  document.cookie = 'saved_password=fixture-%20=value; path=/;';
  document.cookie = 'saved_password=fixture-%20=value; domain=lbry.tv; path=/old; Secure';
  setAuthToken('fixture-auth-token');
  const initial = await getSavedPasswordState();
  assert(initial.password === 'fixture-%20=value' && initial.remembered, 'Migrate the real legacy cookie jar');
  assert(
    localStorage.getItem('__cookieStore__').includes('saved_password'),
    'Keep recovery copy until the next main process'
  );
  assert.equal(getAuthToken(), 'fixture-auth-token', 'Migration must preserve the account cookie');
  assert((await control('status')).state.ciphertext, 'The migrated record must be encrypted');
  assert(await doSignOutCleanup(), 'Local sign-out cleanup must finish');
  assert.equal(await getSavedPassword(), null, 'Sign-out must clear the memory cache');
  assert.equal(getAuthToken(), null, 'Sign-out must remove the account token');

  let closed = 0;
  let encrypted = 0;
  let refreshed = 0;
  const drawEncrypt = (result) =>
    render(
      <Encrypt
        walletEncryptSucceded={result}
        encryptWallet={() => encrypted++}
        closeModal={() => closed++}
        updateWalletStatus={() => refreshed++}
      />,
      store,
      history
    );
  drawEncrypt(null);
  input('wallet-new-password', 'fixture-encryption-password');
  input('wallet-new-password-confirm', 'fixture-encryption-password');
  input('wallet-understand', 'I Understand');
  document.getElementById('wallet-remember-password').click();
  await control('unavailable');
  await control('hold-notice');
  submit();
  drawEncrypt(true);
  await waitFor(async () => (await control('status')).notices.length === 1, 'Report a failed protected save');
  assert.equal(closed, 0, 'A successful wallet operation must explain failed password storage before closing');
  submit();
  assert.equal(encrypted, 1, 'A storage failure must not re-encrypt an already encrypted wallet');
  assert.equal(refreshed, 1, 'Wallet status must still refresh after encryption succeeds');
  await control('acknowledge');
  await waitFor(() => closed === 1, 'Acknowledge the storage warning and continue');
  assert.equal(
    await getSavedPassword(),
    'fixture-encryption-password',
    'Keep the successful password for this session'
  );
  assert.equal((await getSavedPasswordState()).remembered, false, 'Do not claim a failed save was remembered');
  assert(
    !localStorage.getItem('__cookieStore__').includes('fixture-encryption-password'),
    'No new plaintext cookie fallback'
  );
  unmount();

  await control('available');
  const attempts = [];
  const drawUnlock = (result) =>
    render(
      <Unlock
        walletUnlockSucceded={result}
        shouldTryWithBlankPassword={false}
        unlockWallet={(value) => attempts.push(value)}
        closeModal={() => closed++}
        quit={() => {}}
      />,
      store,
      history
    );
  drawUnlock(null);
  await waitFor(() => attempts.length === 1, 'Load the session password');
  assert.equal(
    document.getElementById('wallet-remember-password').checked,
    false,
    'Session passwords must not silently opt in'
  );
  drawUnlock(false);
  input('wallet-password', 'fixture-unlock-password');
  document.getElementById('wallet-remember-password').click();
  submit();
  drawUnlock(null);
  input('wallet-password', 'edited-after-submit');
  drawUnlock(true);
  await waitFor(() => closed === 2, 'Wait for successful protected storage');
  assert.equal(await getSavedPassword(), 'fixture-unlock-password', 'Save the successful submitted password');
  assert.equal((await getSavedPasswordState()).remembered, true);
  unmount();

  let forgotten = 0;
  render(<Forget closeModal={() => closed++} callback={() => forgotten++} />, store, history);
  await control('fail-forget');
  click('Forget');
  await tick();
  // Queue a status request after the forget request, then let the renderer settle.
  await control('status');
  await tick();
  assert.equal(closed, 2, 'Failed removal must keep the Forget dialog open');
  assert.equal(forgotten, 0, 'Failed removal must not call the success callback');
  await control('allow-forget');
  click('Forget');
  await waitFor(() => forgotten === 1, 'Forgetting must be retryable');
  assert.equal(await getSavedPassword(), null, 'Forget must clear session memory');
  unmount();

  let syncComplete;
  let synced = 0;
  const drawSync = () =>
    render(
      <SyncPassword
        getSync={(callback) => {
          syncComplete = callback;
        }}
        getSyncIsPending={false}
        email="fixture@example.invalid"
        passwordError={false}
        signOut={() => {}}
        handleSyncComplete={() => synced++}
      />,
      store,
      history
    );
  drawSync();
  assert.equal(document.getElementById('remember-password').checked, false, 'Cloud sync remembering is opt-in');
  const passwordField = document.querySelector('input[type=password]');
  passwordField.id = 'fixture-sync-password';
  input('fixture-sync-password', 'fixture-sync-password');
  document.getElementById('remember-password').click();
  submit();
  syncComplete(new Error('Synthetic wrong password'), false);
  assert.equal(await getSavedPassword(), null, 'A failed account sync must not save a password');
  submit();
  syncComplete(null, true);
  await waitFor(() => synced === 2, 'Account sync callback must finish');
  assert.equal(await getSavedPassword(), 'fixture-sync-password', 'Successful account sync must use protected storage');
  assert.equal((await getSavedPasswordState()).remembered, true);
  unmount();

  const call = Lbryio.call;
  const timeout = window.setTimeout;
  let signedOut = 0;
  let reloaded = 0;
  try {
    Lbryio.call = async (service, method, params) => {
      assert(service === 'user' && method === 'signout', 'Only the sign-out transport may be called');
      assert.equal(params.auth_token, 'fixture-auth-token', 'Retain the token for remote sign-out after local removal');
      signedOut++;
      throw new Error('Synthetic offline sign-out');
    };
    window.setTimeout = () => {
      reloaded++;
    };
    setAuthToken('fixture-auth-token');
    await control('fail-forget');
    await store.dispatch(doSignOut());
    assert.equal(signedOut, 0, 'A local removal failure must stop sign-out for retry');
    assert.equal(reloaded, 0, 'Do not reload past a failed local cleanup');
    await control('allow-forget');
    await store.dispatch(doSignOut());
    assert.equal(signedOut, 1);
    assert.equal(reloaded, 1, 'Offline sign-out still finishes local cleanup');
    assert.equal(await getSavedPassword(), null);
    assert.equal(getAuthToken(), null);
  } finally {
    Lbryio.call = call;
    window.setTimeout = timeout;
  }

  assert(await deleteSavedPassword());
  assert(await setSavedPassword('fixture-restart-password', true));
  return 'real cookie migration, wallet save failures, successful unlock snapshots, Forget retry, sync opt-in and offline sign-out';
}
