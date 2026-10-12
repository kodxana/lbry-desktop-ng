/* eslint no-console:0 */
const assert = require('assert').strict;
const path = require('path');
const vm = require('vm');
const React = require('react');
const { transformFileSync } = require('@babel/core');

function load(relativePath, dependencies, globals = {}) {
  const { code } = transformFileSync(path.join(__dirname, '../ui', relativePath), {
    babelrc: false,
    configFile: false,
    presets: ['@babel/preset-react', '@babel/preset-flow'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const context = {
    exports: {},
    __: (text, tokens = {}) => text.replace(/%([^%]+)%/g, (match, key) => tokens[key] === undefined ? match : tokens[key]),
    process: { env: { NODE_ENV: 'production' } },
    ...globals,
    require: name => {
      assert(Object.prototype.hasOwnProperty.call(dependencies, name), 'Unexpected import: ' + name);
      return dependencies[name];
    },
  };
  vm.runInNewContext(code, context);
  return context.exports;
}

module.exports = async function startupTests() {
  const walletSync = load('util/wallet-sync.js', {});
  const { startupProgress } = load('util/startup-progress.js', { './wallet-sync': walletSync });
  const connected = { available_servers: 1, connected: 'hub.example:50001', headers_synchronization_progress: 100 };
  assert.equal(startupProgress(null).percent, null);
  assert.equal(startupProgress({ wallet: { ...connected, available_servers: 0 } }).percent, null);
  for (const value of [undefined, null, -1, 101, NaN, '50']) {
    assert.equal(startupProgress({ wallet: { ...connected, headers_synchronization_progress: value } }).percent, null);
  }
  assert.equal(startupProgress({ wallet: { ...connected, headers_synchronization_progress: 0 } }).percent, 0);
  assert.equal(startupProgress({ wallet: connected, is_running: false }).step, 1,
    '100% headers must not mean the whole wallet is ready');
  assert.equal(startupProgress({ wallet: connected, is_running: true }, true).step, 1,
    'An encrypted wallet still needs to be unlocked');
  assert.equal(startupProgress({ wallet: connected, startup_status: { wallet: true } }).step, 2);
  const { withLocalHubPreference } = load('util/hub-preferences.js', {});
  const old = { value: { settings: { lbryum_servers: [['offline.example', 50001]], theme: 'dark' }, other: 'retained' } };
  const before = JSON.stringify(old);
  for (const local of [null, [['working.example', 50001]]]) {
    const updated = withLocalHubPreference(old, local);
    assert.equal(updated.value.settings.lbryum_servers, local);
    assert.equal(updated.value.settings.theme, 'dark');
    assert.equal(updated.value.other, 'retained');
    assert.equal(JSON.stringify(old), before, 'Loading preferences must not mutate the wallet response');
  }
  assert.equal(withLocalHubPreference(null, null), null);

  const timers = new Map();
  let timerId = 0;
  let walletCalls = 0;
  let ready = 0;
  const sdk = {
    status: async () => ({ is_running: false, wallet: { available_servers: 0 }, startup_status: {} }),
    wallet_status: async () => { walletCalls++; throw new Error('Wallet is still starting') },
  };
  const dependencies = { react: React, lbry: sdk, 'constants/modal_types': {}, 'constants/icons': {}, 'util/startup-progress': { startupProgress } };
  for (const name of ['component/button', 'component/setupLayout', 'component/common/icon',
    'modal/modalWalletUnlock', 'modal/modalIncompatibleDaemon', 'modal/modalUpgrade', 'modal/modalDownloading']) {
    dependencies[name] = () => null;
  }
  const Splash = load('component/splash/view.jsx', dependencies, {
    setTimeout: callback => { timers.set(++timerId, callback); return timerId },
    clearTimeout: id => timers.delete(id),
  }).default;
  const splash = new Splash({ daemonVersionMatched: true, onReadyToLaunch: () => ready++ });
  splash.active = true;
  splash.setState = (update, callback) => {
    assert(splash.active, 'Unmounted startup screen must not update state');
    Object.assign(splash.state, update);
    if (callback) callback();
  };
  await splash.updateStatus();
  assert.equal(walletCalls, 1);
  assert.equal(timers.size, 2, 'Keep a poll and a separate progress timer without clearing the selected hub');
  const unchangedTimer = splash.timeout;
  timers.get(unchangedTimer)();
  assert(splash.state.waitingForProgress);
  await splash.updateStatus();
  assert.equal(splash.timeout, unchangedTimer, 'Unchanged polls must not restart the progress timer');
  assert(splash.state.waitingForProgress);
  sdk.status = async () => ({ is_running: false, wallet: { ...connected, headers_synchronization_progress: 40 } });
  await splash.updateStatus();
  assert(!splash.state.waitingForProgress, 'Actual progress clears the waiting message');
  assert.equal(ready, 0, 'Partial header sync cannot open the app');

  const history = { state: 'syncing', connected: true, entries_completed: 100, entries_total: 250, pending_operations: 1 };
  sdk.status = async () => ({ is_running: false, wallet: { ...connected, history_sync: history } });
  await splash.updateStatus();
  const historyTimer = splash.timeout;
  timers.get(historyTimer)();
  history.pending_operations += 1;
  await splash.updateStatus();
  assert.equal(splash.timeout, historyTimer, 'Queue changes without history progress must not hide a stall');
  history.entries_completed = 200;
  await splash.updateStatus();
  assert.notEqual(splash.timeout, historyTimer, 'Saved history batches reset the progress timer');
  assert(!splash.state.waitingForProgress);
  const progress = startupProgress(await sdk.status());
  assert.equal(progress.step, 1);
  assert.equal(progress.title, 'Syncing transaction history');
  assert(progress.history.count.includes('200 of 250'));

  sdk.status = async () => { throw new Error('SDK temporarily unavailable') };
  await splash.updateStatus();
  assert.equal(timers.size, 2, 'API failures must not duplicate poll timers');
  const callsBeforeUnmount = walletCalls;
  let answer;
  sdk.status = () => new Promise(resolve => { answer = resolve });
  const pending = splash.updateStatus();
  splash.componentWillUnmount();
  answer({ is_running: true, wallet: { available_servers: 1 } });
  await pending;
  assert.equal(walletCalls, callsBeforeUnmount, 'An old poll must not query the restarted wallet');
  assert.equal(timers.size, 0);

  splash.active = true;
  sdk.status = async () => ({ is_running: true, wallet: { available_servers: 1 } });
  sdk.wallet_status = async () => ({ is_locked: false });
  sdk.resolve = () => new Promise(resolve => { answer = resolve });
  await splash.updateStatus();
  splash.componentWillUnmount();
  answer({});
  await Promise.resolve();
  assert.equal(ready, 0, 'A stale resolve response must not bypass hub setup');
  assert.equal(timers.size, 0);
  console.log('PASS: truthful header progress, stalled progress detection, local hub preferences and stale startup replies');
};

module.exports.load = load;
