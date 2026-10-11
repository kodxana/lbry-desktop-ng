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
    __: text => text,
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
  const dependencies = { react: React, lbry: sdk, 'constants/modal_types': {}, 'constants/icons': {}, 'css-doodle': {} };
  for (const name of ['component/button', 'component/common/card', 'component/i18nMessage',
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
  assert.equal(timers.size, 1, 'Unavailable wallet must keep polling without clearing the selected hub');
  assert(splash.state.details.includes('choose another hub'));

  sdk.status = async () => { throw new Error('SDK temporarily unavailable') };
  await splash.updateStatus();
  assert.equal(timers.size, 1, 'API failures must not duplicate poll timers');
  let answer;
  sdk.status = () => new Promise(resolve => { answer = resolve });
  const pending = splash.updateStatus();
  splash.componentWillUnmount();
  answer({ is_running: true, wallet: { available_servers: 1 } });
  await pending;
  assert.equal(walletCalls, 1, 'An old poll must not query the restarted wallet');
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
  console.log('PASS: local hub overrides old preferences; startup retries and ignores replies after unmount');
};
