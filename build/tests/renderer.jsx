// @flow
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import { strict as assert } from 'assert';
import { ipcRenderer } from 'electron';
import localForage from 'localforage';
import React from 'react';
import { connect } from 'react-redux';
import { push, goBack } from 'redux-first-history';
import { Route, Link } from 'react-router-dom';
import * as ACTIONS from 'constants/action_types';
import fixture from './fixtures/persist-v0.json';
import { render, unmount } from './helpers';

const phase = new URLSearchParams(window.location.search).get('phase');
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const reportError = (error) => ipcRenderer.send('regression-result', { phase, error: error.stack || String(error) });
window.addEventListener('error', (event) => reportError(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => reportError(event.reason));

async function main() {
  if (phase === 'bundling') return require('./bundling').default();
  window.i18n_messages = {};
  if (phase === 'analyticsUnconfigured') require('config').MATOMO_URL = '';
  await localForage.setDriver(localForage.INDEXEDDB);
  if (phase === 'fresh') await localForage.clear();
  if (phase === 'legacy') await localForage.setItem('persist:v0', fixture.serialized);
  // Match desktop startup: analytics imports the store before attaching its history listener.
  require('analytics');
  // Import after seeding storage. The production store owns all transforms and reducers.
  const { store, persistor, history } = require('../../ui/store');
  await new Promise((resolve) => {
    if (persistor.getState().bootstrapped) return resolve();
    const unsubscribe = persistor.subscribe(() => {
      if (persistor.getState().bootstrapped) {
        unsubscribe();
        resolve();
      }
    });
  });
  assert.equal(localForage.driver(), localForage.INDEXEDDB);
  if (phase.startsWith('analytics')) {
    const message = await require('./analytics').default(phase, history);
    persistor.pause();
    return message;
  }
  if (
    phase === 'reactState' ||
    phase === 'uiComponents' ||
    phase === 'accessibleControls' ||
    phase === 'collections' ||
    phase === 'browserIntegrations' ||
    phase === 'formsAndDates' ||
    phase === 'markdownEditor' ||
    phase === 'documents' ||
    phase === 'comics' ||
    phase === 'three' ||
    phase === 'media' ||
    phase === 'fileDialogs' ||
    phase === 'fileUploads' ||
    phase === 'windowControls' ||
    phase === 'contextMenu' ||
    phase === 'updater' ||
    phase === 'updaterRestart' ||
    phase === 'wallet' ||
    phase === 'downloadNotifications' ||
    phase === 'passwords' ||
    phase === 'passwordRestart'
  ) {
    // Follow the desktop component import order to resolve its existing app/router cycle.
    require('component/app');
    const tests = {
      reactState: () => require('./reactState'),
      uiComponents: () => require('./uiComponents'),
      accessibleControls: () => require('./accessibleControls'),
      collections: () => require('./collections'),
      browserIntegrations: () => require('./browserIntegrations'),
      formsAndDates: () => require('./formsAndDates'),
      markdownEditor: () => require('./markdownEditor'),
      documents: () => require('./documents'),
      comics: () => require('./comics'),
      three: () => require('./three'),
      media: () => require('./media'),
      fileDialogs: () => require('./fileDialogs'),
      fileUploads: () => require('./fileUploads'),
      windowControls: () => require('./windowControls'),
      contextMenu: () => require('./contextMenu'),
      updater: () => require('./updater'),
      updaterRestart: () => require('./updaterRestart'),
      wallet: () => require('./wallet'),
      downloadNotifications: () => require('./downloadNotifications'),
      passwords: () => require('./passwords'),
      passwordRestart: () => require('./passwordRestart'),
    };
    const test = tests[phase]().default;
    const { root } = await ipcRenderer.invoke('fixture-desktop-info');
    const message = await test(store, history, root);
    persistor.pause();
    return message;
  }
  let state = store.getState();
  assert.equal(state.wallet.totalBalance, undefined, 'A restart must request a fresh balance');
  assert.equal(state.wallet.syncStatus, null, 'A restart must not reuse completed wallet sync status');
  assert.equal(state.app.daemonReady, false);
  if (phase === 'fresh') {
    assert.equal(state.settings.clientSettings.theme, 'dark');
    assert.deepEqual(state.content.positions, {});
    assert.deepEqual(state.subscriptions.subscriptions, []);
  } else {
    for (const [slice, expected] of Object.entries(fixture.expected)) {
      for (const [key, value] of Object.entries(expected)) {
        if (slice === 'settings' && key === 'clientSettings') {
          for (const [setting, expectedValue] of Object.entries(value)) {
            assert.deepEqual(
              state.settings.clientSettings[setting],
              expectedValue,
              'Saved setting: ' + setting + ' = ' + JSON.stringify(state.settings.clientSettings[setting])
            );
          }
        } else if (slice === 'content' && key === 'positions' && phase === 'restart') {
          assert.equal(state.content.positions['fixture-claim']['fixture-tx:0'], 81.25);
        } else {
          assert.deepEqual(state[slice][key], value, 'Saved state: ' + slice + '.' + key);
        }
      }
    }
    assert.equal(state.settings.clientSettings.video_playback_rate, 1, 'New defaults survive legacy rehydration');
  }

  const { testSelectors, testSubscriptionsAndThunks, testPersistedState } = require('./stateManagement');
  testSelectors();
  await testSubscriptionsAndThunks(store);
  assert.equal(state.wallet.draftTransaction.amount, undefined, 'A restart must discard unsent transactions');
  assert.equal(state.wallet.draftTransaction.address, undefined);

  function Position({ positions }: { positions: { [string]: { [string]: number } } }) {
    return <output id="position">{positions['fixture-claim'] && positions['fixture-claim']['fixture-tx:0']}</output>;
  }
  const ConnectedPosition = connect((value) => ({ positions: value.content.positions }))(Position);
  const container = document.getElementById('app');
  render(
    <div>
      <Link id="wallet-link" to="/$/wallet?tab=history">
        Wallet
      </Link>
      <Route path="/$/wallet" render={() => <div id="wallet-page">Wallet route</div>} />
      <ConnectedPosition />
    </div>,
    store,
    history
  );
  await tick();
  document.getElementById('wallet-link').click();
  await tick();
  assert(document.getElementById('wallet-page'), 'Router link must render its destination');
  assert.equal(store.getState().router.location.search, '?tab=history');
  store.dispatch(push('/fixture-content:abc?t=81'));
  await tick();
  assert.equal(history.location.pathname, '/fixture-content:abc');
  assert(!document.getElementById('wallet-page'));
  store.dispatch(goBack());
  await tick();
  assert(document.getElementById('wallet-page'), 'Back navigation must restore the route');

  store.dispatch({
    type: ACTIONS.SET_CONTENT_POSITION,
    data: { claimId: 'fixture-claim', outpoint: 'fixture-tx:0', position: 81.25 },
  });
  await tick();
  assert.equal(document.getElementById('position').textContent, '81.25', 'React subscriptions follow Redux changes');
  store.dispatch({
    type: ACTIONS.UPDATE_BALANCE,
    data: {
      totalBalance: 123,
      balance: 100,
      syncStatus: { is_running: true, wallet: { history_sync: { state: 'complete' } } },
    },
  });
  assert.equal(store.getState().wallet.totalBalance, 123);
  store.dispatch({ type: ACTIONS.DAEMON_READY });
  assert.equal(store.getState().app.daemonReady, true);
  await testPersistedState(store, persistor);
  await persistor.flush();
  assert.equal(typeof (await localForage.getItem('persist:v0')), 'string');
  persistor.pause();
  unmount();
  assert.equal(container.childElementCount, 0);
  history.push('/after-unmount');
  await tick();
  assert.equal(
    store.getState().router.location,
    history.location,
    'Navigation remains owned by the store after UI unmount'
  );
  assert.equal(container.childElementCount, 0, 'Unmounted routes must not render after navigation');
  return phase + ': legacy rehydration, persistence filters, selectors, thunks, nested React subscriptions and routing';
}

main()
  .then((message) => ipcRenderer.send('regression-result', { phase, message }))
  .catch(reportError);
