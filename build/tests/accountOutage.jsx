import { strict as assert } from 'assert';
import React from 'react';
import { Lbryio } from 'lbryinc';
import Lbry from 'lbry';
import desktop from 'util/desktop';
import * as ACTIONS from 'constants/action_types';
import { doAuthenticate, doUserFetch } from 'redux/actions/user';
import { doGetAndPopulatePreferences } from 'redux/actions/app';
import { doGetWalletSyncPreference } from 'redux/actions/settings';
import { doGetSync } from 'redux/actions/sync';
import { getSavedPassword, setSavedPassword, deleteSavedPassword } from 'util/saved-passwords';
import AccountServiceStatus from 'component/accountServiceStatus';
import { render, unmount, waitFor } from './helpers';

export default async function accountOutage(store, history) {
  const oldFetch = window.fetch;
  const originals = { ...Lbry };
  const originalHubs = desktop.hubConfig;
  const requests = [];
  const writes = [];
  let response = async () => new Response('Unavailable', { status: 503 });
  const json = (data) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
  Lbryio.authToken = 'saved-fixture-token';
  window.fetch = async (url, options) => {
    assert(String(url).startsWith(Lbryio.CONNECTION_STRING), 'The fixture must not contact unrelated services');
    requests.push(String(url));
    return response(url, options);
  };
  desktop.hubConfig = async () => [['fixture-hub.invalid', 50001]];
  const preference = { version: '0.1', value: { settings: { theme: 'dark' }, subscriptions: ['lbry://@fixture#abc'] } };
  Lbry.preference_get = async ({ key }) => {
    assert(['enable-sync', 'shared'].includes(key), 'An outage must not switch a synced wallet to local preferences');
    return key === 'enable-sync' ? { 'enable-sync': true } : { shared: preference };
  };
  Lbry.preference_set = async (params) => {
    writes.push(params);
    return {};
  };
  Lbry.wallet_status = async () => ({ is_locked: false });
  Lbry.sync_hash = async () => 'last-good';
  Lbry.sync_apply = async () => assert.fail('Unavailable or unchanged cloud data must not modify the wallet');
  try {
    await setSavedPassword('outage-fixture-password');
    store.dispatch({
      type: ACTIONS.GET_SYNC_COMPLETED,
      data: { hasSyncedWallet: true, syncHash: 'last-good', syncData: 'encrypted-fixture' },
    });
    await store.dispatch(doAuthenticate(undefined, null, null, false));
    assert.equal(store.getState().user.userIsPending, false);
    assert.equal(store.getState().user.accountServiceUnavailable, true);
    await assert.rejects(store.dispatch(doUserFetch()));
    assert.equal(store.getState().user.userIsPending, false, 'A failed account refresh must stop its spinner');
    await store.dispatch(doGetWalletSyncPreference());
    await store.dispatch(doGetAndPopulatePreferences());
    assert.equal(store.getState().sync.prefsReady, true);
    assert.equal(store.getState().settings.clientSettings.theme, 'dark');
    assert.equal(store.getState().subscriptions.subscriptions[0].uri, 'lbry://@fixture#abc');
    store.dispatch({ type: ACTIONS.SHARED_PREFERENCE_SET, data: { key: 'theme', value: 'light' } });
    await waitFor(() => writes.length > 0, 'Local preferences must still be saved during the outage');
    assert(writes.every((write) => write.key === 'shared'));
    assert.equal(JSON.parse(writes.at(-1).value).value.settings.theme, 'light');
    await store.dispatch(doGetSync('outage-fixture-password'));
    assert.equal(store.getState().sync.syncHash, 'last-good');
    assert.equal(store.getState().sync.syncData, 'encrypted-fixture');
    assert(!store.getState().sync.fatalError);
    assert.equal(store.getState().sync.syncApplyPasswordError, false);
    render(<AccountServiceStatus />, store, history);
    assert(document.querySelector('[role="status"]').textContent.includes('Cloud backups may be out of date'));
    assert(document.querySelector('.nag--relative'), 'The notice must not overlay update controls or page content');
    let finish;
    response = async (url) => {
      if (String(url).includes('/user/me'))
        return new Promise((resolve) => {
          finish = resolve;
        });
      assert(String(url).includes('/sync/get'));
      return json({ hash: 'last-good', changed: false });
    };
    document.querySelector('button').click();
    await waitFor(() => finish && document.querySelector('button').disabled, 'Retry must expose its pending state');
    finish(json({ id: 42, has_verified_email: true }));
    await waitFor(
      () => !document.querySelector('[role="status"]'),
      'Recovery must clear the notice without restarting'
    );
    assert.equal(store.getState().user.user.id, 42);
    assert.equal(Lbryio.authToken, 'saved-fixture-token');
    assert.equal(await getSavedPassword(), 'outage-fixture-password');
    assert(requests.every((url) => !url.includes('/user/new') && !url.includes('/sync/set')));
  } finally {
    unmount();
    window.fetch = oldFetch;
    Object.assign(Lbry, originals);
    desktop.hubConfig = originalHubs;
    await deleteSavedPassword();
  }
  return 'account outage: local preferences, cloud-backup preservation, retry UI and saved-password recovery';
}
