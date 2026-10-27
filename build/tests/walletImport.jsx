import { strict as assert } from 'assert';
import React from 'react';
import { flushSync } from 'react-dom';
import { ipcRenderer } from 'electron';
import desktop from 'util/desktop';
import WalletSetup from 'component/walletSetup';
import 'scss/third-party.scss';
import 'scss/all.scss';
import { render, unmount, waitFor, input, submit, tick } from './helpers';

export default async function walletImport(store, history) {
  document.documentElement.setAttribute('theme', 'dark');
  document.documentElement.setAttribute('dir', 'ltr');
  const original = desktop.walletSetup;
  const calls = [];
  let canceled = true;
  let checked = false;
  let continued = false;
  desktop.walletSetup = async (operation, value) => {
    calls.push([operation, value]);
    if (operation === 'state') return { hasWallet: true, profiles: [{ id: 'original', label: 'Original NG profile' }] };
    if (operation === 'choose')
      return canceled ? { canceled: true } : { choices: [{ id: '0', name: 'wallets/default_wallet' }] };
    if (operation === 'preview') {
      checked = value.password === 'fixture-password';
      return checked
        ? { ok: true, encrypted: true, accounts: 2, channels: 3 }
        : { ok: false, error: value.password ? 'password' : 'password-required' };
    }
    if (operation === 'import') {
      assert(checked && value.confirmed);
      return { restarting: true };
    }
    return { pending: false };
  };
  const button = (text) => [...document.querySelectorAll('button')].find((item) => item.textContent.includes(text));
  const click = (text) => flushSync(() => button(text).click());
  try {
    render(
      <WalletSetup
        onContinue={() => {
          continued = true;
        }}
      />,
      store,
      history
    );
    await waitFor(
      () => button('Continue to hub selection') && !button('Continue to hub selection').disabled,
      'Existing wallet choice'
    );
    assert.equal(document.querySelector('.setup-layout').getAttribute('theme'), 'dark');
    assert.notEqual(getComputedStyle(document.querySelector('.setup-layout')).backgroundColor, 'rgba(0, 0, 0, 0)');
    assert(document.getElementById('wallet-keep').checked);
    document.getElementById('wallet-import').click();
    await tick();
    assert(button('Continue and restart').disabled);
    click('Choose wallet or backup');
    await waitFor(() => !button('Choose wallet or backup').disabled, 'File chooser cancellation completes');
    assert(button('Continue and restart').disabled, 'Cancel cannot approve import');
    canceled = false;
    click('Choose wallet or backup');
    await waitFor(() => document.getElementById('import-wallet-password'), 'Encrypted wallet password prompt');
    input('import-wallet-password', 'wrong');
    submit();
    await waitFor(() => document.body.textContent.includes('That password did not unlock'), 'Wrong password feedback');
    assert.equal(document.getElementById('import-wallet-password').value, '');
    input('import-wallet-password', 'fixture-password');
    submit();
    await waitFor(() => document.body.textContent.includes('2 account(s), 3 channel key(s)'), 'Import preview counts');
    assert(!document.getElementById('import-wallet-password'), 'Clear the password field after checking');
    assert(document.body.textContent.includes('Odysee wallet sync is off'));
    await ipcRenderer.invoke('fixture-wallet-import-capture');
    assert(button('Continue and restart').disabled, 'Preview is not consent');
    document.getElementById('wallet-import-confirm').click();
    await tick();
    assert(!button('Continue and restart').disabled);
    button('Continue and restart').click();
    await waitFor(() => calls.some(([operation]) => operation === 'import'), 'Import commit');
    assert(!continued, 'Import must restart into its own profile before hub sync');
    unmount();
    render(
      <WalletSetup
        onContinue={() => {
          continued = true;
        }}
      />,
      store,
      history
    );
    await waitFor(
      () => button('Continue to hub selection') && !button('Continue to hub selection').disabled,
      'Existing wallet choice after reopening'
    );
    button('Continue to hub selection').click();
    await waitFor(() => continued, 'Keep existing wallet continues without restart');
    return 'wallet import UI: dark setup, cancellation, wrong password, verified counts, cloud notice and explicit confirmation';
  } finally {
    unmount();
    desktop.walletSetup = original;
  }
}
