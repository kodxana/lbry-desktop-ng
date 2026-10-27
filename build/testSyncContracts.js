/* eslint no-console:0 */
const assert = require('assert').strict;
const { load } = require('./testStartup');
const actions = load('constants/action_types.js', {});
const settings = load('constants/settings.js', {});
const daemonSettings = load('constants/daemon_settings.js', {});
const shared = load('constants/shared_preferences.js', { './daemon_settings': daemonSettings, './settings': settings });
const tick = () => new Promise((resolve) => setImmediate(resolve));
const plain = (value) => JSON.parse(JSON.stringify(value));
const events = [];
const calls = [];
let state = {};
let savedPassword = null;
let encryption;
let decryption;
const sdk = {
  wallet_encrypt: async () => (typeof encryption === 'function' ? encryption() : encryption),
  wallet_decrypt: async () => (typeof decryption === 'function' ? decryption() : decryption),
};
const wallet = load('redux/actions/wallet.js', {
  'constants/action_types': actions,
  lbry: sdk,
  lbryinc: {},
  'redux/actions/notifications': {},
  'redux/selectors/wallet': {},
  'util/format-credits': {},
  'redux/selectors/claims': {},
  'redux/actions/claims': {},
  'util/wallet-sync': {},
});
const sync = load(
  'redux/actions/sync.js',
  {
    'constants/action_types': actions,
    'constants/settings': settings,
    'constants/shared_preferences': shared,
    lbryinc: {
      Lbryio: {
        call: (...args) => {
          calls.push(args);
          return api(...args);
        },
      },
    },
    lbry: sdk,
    'redux/actions/wallet': wallet,
    'redux/selectors/sync': {
      selectSyncHash: (state) => state.hash,
      selectGetSyncIsPending: (state) => state.getPending,
      selectSetSyncIsPending: (state) => state.setPending,
      selectSyncIsLocked: (state) => state.locked,
    },
    'redux/selectors/settings': { makeSelectClientSetting: () => (state) => state.enabled },
    'util/saved-passwords': { getSavedPassword: async () => savedPassword },
    'redux/actions/app': {
      doAnalyticsTagSync: () => ({ type: 'analytics' }),
      doHandleSyncComplete: () => ({ type: 'complete' }),
    },
    'redux/selectors/user': { selectUserVerifiedEmail: () => false },
    comments: { setServerUrl: () => {} },
    'util/sync-settings': load('util/sync-settings.js', {
      'constants/daemon_settings': daemonSettings,
      'util/deep-equal': load('util/deep-equal.js', {}).default,
    }),
  },
  { console: { error: () => {} }, setInterval, clearInterval }
);
let api = async (_resource, method) =>
  method === 'get' ? { hash: 'old-hash', data: 'old-data' } : { hash: 'new-hash' };
const dispatch = (action) => (typeof action === 'function' ? action(dispatch, () => state) : events.push(action));

async function encryptionOrdering() {
  for (const encrypt of [true, false]) {
    calls.length = events.length = 0;
    let finish;
    const pending = new Promise((resolve) => {
      finish = resolve;
    });
    if (encrypt) encryption = pending;
    else decryption = pending;
    sdk.sync_hash = async () => 'old-hash';
    sdk.sync_apply = async (params) => {
      calls.push(['apply', plain(params)]);
      return { hash: 'new-hash', data: 'new-data' };
    };
    const operation = dispatch(sync.doSyncEncryptAndDecrypt('old-password', 'new-password', encrypt));
    await tick();
    assert.equal(
      calls.filter(([name]) => name === 'apply').length,
      1,
      'Sync must wait for wallet encryption/decryption before exporting'
    );
    finish(true);
    await operation;
    assert.deepEqual(
      calls.filter(([name]) => name === 'apply'),
      [
        ['apply', { password: 'old-password', data: 'old-data' }],
        ['apply', { password: 'new-password' }],
      ]
    );
    assert(
      calls.some(([, method]) => method === 'set'),
      'Changed encrypted wallet data must be uploaded'
    );
  }
}

async function encryptionFailures() {
  for (const encrypt of [true, false]) {
    for (const outcome of [false, () => Promise.reject(Error('fixture encryption failure'))]) {
      calls.length = events.length = 0;
      encryption = decryption = outcome;
      await dispatch(sync.doSyncEncryptAndDecrypt('old', 'new', encrypt));
      assert.equal(
        calls.filter(([name]) => name === 'apply').length,
        1,
        'Failed encryption/decryption must not export'
      );
      assert(!calls.some(([, method]) => method === 'set'), 'Failed encryption/decryption must not upload');
    }
  }
  encryption = decryption = true;
  sdk.sync_apply = async (params) => {
    calls.push(['apply', params]);
    return { hash: 'old-hash', data: 'same' };
  };
  calls.length = 0;
  await dispatch(sync.doSyncEncryptAndDecrypt('old', 'new', true));
  assert(!calls.some(([, method]) => method === 'set'), 'An unchanged hash needs no upload');
  for (const response of [{ data: 'missing hash' }, { hash: 12 }, null]) {
    api = async () => response;
    calls.length = 0;
    await dispatch(sync.doSyncEncryptAndDecrypt('old', 'new', true));
    assert(!calls.some(([name]) => name === 'apply'), 'Malformed remote sync must not change the wallet');
  }
  for (const failure of ['get', 'apply']) {
    api = async () => {
      if (failure === 'get') throw Error('get failed');
      return { hash: 'old-hash', data: 'old-data' };
    };
    sdk.sync_apply = async () => {
      throw Error('apply failed');
    };
    calls.length = 0;
    await dispatch(sync.doSyncEncryptAndDecrypt('old', 'new', true));
    assert(!calls.some(([, method]) => method === 'set'), 'Import failures must not upload');
  }
}

async function savedPasswordSync() {
  const passwords = [];
  sdk.wallet_status = async () => ({ is_locked: true });
  sdk.wallet_unlock = async ({ password }) => {
    passwords.push(password);
    return true;
  };
  sdk.sync_hash = async () => 'old-hash';
  api = async () => ({ hash: 'old-hash', changed: false });
  state = { enabled: true, hash: 'old-hash' };
  savedPassword = 'stored-password';
  for (const [password, expected] of [
    [undefined, 'stored-password'],
    ['', ''],
    ['explicit-password', 'explicit-password'],
  ]) {
    await new Promise((resolve, reject) =>
      dispatch(
        sync.doGetSyncDesktop((error, changed) => {
          try {
            assert.equal(error, null);
            assert.equal(changed, false);
            resolve();
          } catch (error) {
            reject(error);
          }
        }, password)
      )
    );
    assert.equal(passwords.at(-1), expected);
  }
  savedPassword = null;
  await new Promise((resolve) => dispatch(sync.doGetSyncDesktop(resolve)));
  assert.equal(passwords.at(-1), '');
  const count = passwords.length;
  for (const flags of [{ enabled: false }, { getPending: true }, { setPending: true }, { locked: true }]) {
    state = { enabled: true, ...flags };
    await dispatch(sync.doGetSyncDesktop());
  }
  assert.equal(passwords.length, count, 'Disabled, busy or locked sync must not unlock the wallet');
  state = { enabled: true };
  sdk.wallet_unlock = async () => false;
  calls.length = 0;
  await new Promise((resolve) =>
    dispatch(
      sync.doGetSync('wrong', (error) => {
        assert(error);
        resolve();
      })
    )
  );
  assert.equal(calls.length, 0, 'A failed unlock must not read or write remote wallet data');
  assert.equal(events.at(-1).type, actions.GET_SYNC_FAILED);

  sdk.wallet_status = async () => ({ is_locked: false });
  api = async (_resource, method) => {
    if (method === 'get') throw Error('no wallet found for this user');
    return { hash: 'new-hash' };
  };
  sdk.sync_apply = async ({ password }) => {
    assert.equal(password, 'first-password');
    return { hash: 'new-hash', data: 'encrypted-fixture' };
  };
  calls.length = 0;
  await new Promise((resolve) => dispatch(sync.doGetSync('first-password', resolve)));
  await tick();
  assert.deepEqual(plain(calls.at(-1)), [
    'sync',
    'set',
    { old_hash: '', new_hash: 'new-hash', data: 'encrypted-fixture' },
    'post',
  ]);
}

async function preferences() {
  let stored;
  sdk.preference_set = async (params) => {
    stored = plain(params);
  };
  const value = { settings: { theme: 'dark' }, subscriptions: ['lbry://@fixture'] };
  await new Promise((resolve) => dispatch(sync.doPreferenceSet('shared', value, '0.1', resolve)));
  assert.deepEqual(stored, { key: 'shared', value: JSON.stringify({ type: 'object', version: '0.1', value }) });
  const preference = JSON.parse(stored.value);
  sdk.preference_get = async () => ({ shared: preference });
  let received;
  await dispatch(
    sync.doPreferenceGet('shared', (value) => {
      received = value;
    })
  );
  assert.deepEqual(received, preference);
  sdk.preference_get = async () => null;
  await dispatch(
    sync.doPreferenceGet('shared', (value) => {
      received = value;
    })
  );
  assert.equal(received, null);
  const error = Error('preference persistence failed');
  sdk.preference_set = sdk.preference_get = async () => {
    throw error;
  };
  await new Promise((resolve) => dispatch(sync.doPreferenceSet('shared', value, '0.1', assert.fail, resolve)));
  assert.equal(events.at(-1).type, actions.SYNC_FATAL_ERROR);
  await dispatch(sync.doPreferenceGet('shared', assert.fail, (failure) => assert.equal(failure, error)));
  assert.equal(events.at(-1).error, error);

  state = { settings: { clientSettings: { theme: 'light', localOnly: true } } };
  dispatch(sync.doPopulateSharedUserState(preference));
  assert.deepEqual(plain(events.at(-1).data.subscriptions), value.subscriptions);
  assert.equal(events.at(-1).data.mergedClientSettings.theme, 'dark');
  assert.equal(events.at(-1).data.mergedClientSettings.localOnly, true);
  assert.deepEqual(preference.value, value, 'Populating shared state must not mutate the stored preference');
  for (const unsupported of [null, { version: 'future', value }]) {
    dispatch(sync.doPopulateSharedUserState(unsupported));
    assert.equal(events.at(-1).data.subscriptions, undefined);
    assert.equal(events.at(-1).data.mergedClientSettings.theme, 'light');
  }
}

async function outages() {
  savedPassword = 'stored-password';
  const reducer = load('redux/reducers/sync.js', { 'constants/action_types': actions }).default;
  const before = {
    ...reducer(undefined, { type: 'init' }),
    hasSyncedWallet: true,
    syncHash: 'last-good',
    syncData: 'encrypted-backup',
  };
  state = { enabled: true, hash: 'last-good' };
  sdk.wallet_status = async () => ({ is_locked: false });
  sdk.sync_hash = async () => 'local-hash';
  sdk.sync_apply = async (params) => {
    calls.push(['apply', params]);
    return { hash: 'merged-hash', data: 'encrypted-merged' };
  };
  for (const response of [
    () => {
      throw Error('service unavailable');
    },
    () => null,
    () => ({ data: 'missing hash' }),
    () => ({ hash: 'remote-hash', changed: true }),
  ]) {
    api = async () => response();
    for (const checkOnly of [false, true]) {
      calls.length = events.length = 0;
      let callbackError;
      if (checkOnly) await dispatch(sync.doCheckSync());
      else
        await dispatch(
          sync.doGetSync('stored-password', (error) => {
            callbackError = error;
          })
        );
      const after = events.reduce(reducer, before);
      assert.equal(after.syncHash, 'last-good');
      assert.equal(after.syncData, 'encrypted-backup');
      assert.equal(after.hasSyncedWallet, true);
      assert.equal(after.getSyncIsPending, false);
      assert.equal(after.fatalError, false);
      assert.equal(after.syncApplyPasswordError, false);
      assert.equal(after.serviceUnavailable, true);
      if (!checkOnly) assert(callbackError, 'An outage must settle the caller with a failure');
      assert(
        !calls.some(([name, method]) => name === 'apply' || method === 'set'),
        'An outage must neither import nor upload a wallet'
      );
      assert.equal(savedPassword, 'stored-password');
    }
  }
  for (const firstBackup of [false, true]) {
    calls.length = events.length = 0;
    api = async (_resource, method) => {
      if (method === 'set') throw Error('upload unavailable');
      if (firstBackup) throw Error('no wallet found for this user');
      return { hash: 'remote-hash', changed: true, data: 'encrypted-remote' };
    };
    let callbackError;
    await dispatch(
      sync.doGetSync('stored-password', (error) => {
        callbackError = error;
      })
    );
    assert(callbackError, 'An unsuccessful upload must never report a completed backup');
    assert(!events.some((event) => event.type === actions.SET_SYNC_COMPLETED));
    const after = events.reduce(reducer, before);
    assert.equal(after.syncHash, before.syncHash);
    assert.equal(after.getSyncIsPending, false);
    assert.equal(after.setSyncIsPending, false);
    assert.equal(after.serviceUnavailable, true);
  }
  events.length = 0;
  api = async (_resource, method) =>
    method === 'set' ? { hash: 'merged-hash' } : { hash: 'remote-hash', changed: true, data: 'encrypted-remote' };
  await dispatch(sync.doGetSync('stored-password'));
  assert.equal(events.reduce(reducer, before).syncHash, 'merged-hash', 'A completed upload must retain its new hash');
  events.length = 0;
  api = async () => ({ hash: 'last-good', changed: false });
  await dispatch(sync.doGetSync('stored-password'));
  assert.equal(events.reduce(reducer, { ...before, serviceUnavailable: true }).serviceUnavailable, false);
}

async function main() {
  await encryptionOrdering();
  await encryptionFailures();
  await savedPasswordSync();
  await preferences();
  await outages();
  console.log(
    'PASS sync ordering, outage recovery, failed uploads, saved passwords, first sync and preference persistence'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
