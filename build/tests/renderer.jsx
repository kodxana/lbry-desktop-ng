import { strict as assert } from 'assert';
import { ipcRenderer } from 'electron';
import localForage from 'localforage';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider, connect } from 'react-redux';
import { ConnectedRouter, push, goBack } from 'connected-react-router';
import { Route, Link } from 'react-router-dom';
import * as ACTIONS from 'constants/action_types';
import fixture from './fixtures/persist-v0.json';

const phase = new URLSearchParams(window.location.search).get('phase');
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function main() {
  window.i18n_messages = {};
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

  function Position({ positions }) {
    return <output id="position">{positions['fixture-claim'] && positions['fixture-claim']['fixture-tx:0']}</output>;
  }
  const ConnectedPosition = connect((value) => ({ positions: value.content.positions }))(Position);
  const container = document.getElementById('app');
  ReactDOM.render(
    <Provider store={store}>
      <ConnectedRouter history={history}>
        <div>
          <Link id="wallet-link" to="/$/wallet?tab=history">
            Wallet
          </Link>
          <Route path="/$/wallet" render={() => <div id="wallet-page">Wallet route</div>} />
          <ConnectedPosition />
        </div>
      </ConnectedRouter>
    </Provider>,
    container
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
  await persistor.flush();
  assert.equal(typeof (await localForage.getItem('persist:v0')), 'string');
  persistor.pause();
  ReactDOM.unmountComponentAtNode(container);
  assert.equal(container.childElementCount, 0);
  const lastLocation = store.getState().router.location;
  history.push('/after-unmount');
  await tick();
  assert.deepEqual(store.getState().router.location, lastLocation, 'Unmount must remove the router history listener');
  return phase + ': real store rehydration, IndexedDB persistence, React updates and router navigation';
}

main()
  .then((message) => ipcRenderer.send('regression-result', { phase, message }))
  .catch((error) => ipcRenderer.send('regression-result', { phase, error: error.stack || String(error) }));
