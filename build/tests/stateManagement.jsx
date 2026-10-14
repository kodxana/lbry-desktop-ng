import { strict as assert } from 'assert';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider, connect } from 'react-redux';
import localForage from 'localforage';
import createCompressor from 'redux-persist-transform-compress';
import * as ACTIONS from 'constants/action_types';
import { selectClaimsById, selectClaimForUri } from 'redux/selectors/claims';
import { selectSubscriptions } from 'redux/selectors/subscriptions';
import { tick } from './helpers';

export function testSelectors() {
  const confirmed = Object.freeze({ claim_id: 'abc', name: 'fixture', title: 'Confirmed' });
  const pending = Object.freeze({ ...confirmed, title: 'Pending update' });
  const repost = Object.freeze({ claim_id: 'def', name: 'repost', reposted_claim: confirmed });
  const byId = Object.freeze({ abc: confirmed, def: repost });
  const state = {
    claims: {
      byId,
      pendingById: Object.freeze({ abc: pending }),
      claimsByUri: { 'lbry://fixture#abc': 'abc', 'lbry://repost#def': 'def', 'lbry://missing': null },
    },
  };
  assert.equal(selectClaimsById(state).abc, pending);
  assert.equal(byId.abc, confirmed, 'Reading pending claims must not overwrite confirmed state');
  assert.equal(selectClaimForUri(state, 'lbry://fixture#abc'), pending);
  const resolvedRepost = selectClaimForUri(state, 'lbry://repost#def');
  assert.equal(resolvedRepost.claim_id, confirmed.claim_id);
  assert.equal(selectClaimForUri(state, 'lbry://repost#def', false), repost);
  assert.equal(selectClaimForUri(state, 'lbry://repost#def'), resolvedRepost);
  assert.equal(selectClaimForUri(state, 'lbry://missing'), null);
  assert.equal(selectClaimForUri(state, 'lbry://unresolved'), undefined);
  const settled = { claims: { ...state.claims, pendingById: Object.freeze({}) } };
  assert.equal(
    selectClaimForUri(settled, 'lbry://fixture#abc'),
    confirmed,
    'Removed pending overlays must leave the cache'
  );
  assert.equal(
    selectClaimForUri(state, 'lbry://fixture#abc'),
    pending,
    'Reading an older snapshot must remain independent'
  );

  const subscriptions = Object.freeze([{ channelName: '@zebra' }, { channelName: '@alpha' }]);
  const subscribed = { subscriptions: { subscriptions } };
  const sorted = selectSubscriptions(subscribed);
  assert.deepEqual(
    sorted.map((item) => item.channelName),
    ['@alpha', '@zebra']
  );
  assert.equal(subscriptions[0].channelName, '@zebra', 'Sorting must not change persisted subscription order');
  assert.equal(selectSubscriptions(subscribed), sorted, 'Unchanged input must reuse the selected array');
  assert.deepEqual(selectSubscriptions({ subscriptions: { subscriptions: [] } }), []);
}

export async function testSubscriptionsAndThunks(store) {
  const claimId = 'fixture-connected-row';
  const outpoint = 'fixture-row:0';
  const position = (value) => ({
    type: ACTIONS.SET_CONTENT_POSITION,
    data: { claimId, outpoint, position: value },
  });
  const clear = { type: ACTIONS.CLEAR_CONTENT_POSITION, data: { claimId, outpoint } };
  const read = () => store.getState().content.positions[claimId][outpoint];
  assert.equal(
    await store.dispatch(async (dispatch, getState) => {
      dispatch(position(10));
      await tick();
      return getState().content.positions[claimId][outpoint];
    }),
    10,
    'Thunk return values must reach callers'
  );
  const failure = new Error('Fixture thunk failure');
  let rejected;
  try {
    await store.dispatch(async () => {
      throw failure;
    });
  } catch (error) {
    rejected = error;
  }
  assert.equal(rejected, failure, 'Thunk failures must reach callers');
  const observed = [];
  const unsubscribe = store.subscribe(() => observed.push(read()));
  store.dispatch({
    type: 'BATCH_ACTIONS',
    actions: [(dispatch) => dispatch(position(20)), position(30), position(40)],
  });
  unsubscribe();
  assert.deepEqual(observed, [20, 40], 'Bulk thunks run first; plain actions notify once with the final state');

  let childReads = 0;
  const Row = connect((state, props) => {
    childReads++;
    // Deliberately requires the row to exist: the connected parent must unmount
    // this child before notifying it with props for a deleted row.
    return { value: state.content.positions[props.id][outpoint] };
  })(({ value }) => <output>{value}</output>);
  const Rows = connect((state) => ({ present: Boolean(state.content.positions[claimId]) }))(({ present }) =>
    present ? <Row id={claimId} /> : <span>Removed</span>
  );
  const container = document.createElement('div');
  document.body.appendChild(container);
  ReactDOM.render(
    <Provider store={store}>
      <Rows />
    </Provider>,
    container
  );
  await tick();
  assert.equal(container.textContent, '40');
  store.dispatch(position(50));
  await tick();
  assert.equal(container.textContent, '50');
  store.dispatch(clear);
  await tick();
  assert.equal(container.textContent, 'Removed', 'Parent subscriptions must update before removed children');
  ReactDOM.unmountComponentAtNode(container);
  const readsAfterUnmount = childReads;
  store.dispatch(position(60));
  await tick();
  assert.equal(childReads, readsAfterUnmount, 'Unmounted children must unsubscribe');
  store.dispatch(clear);
  container.remove();
}

export async function testPersistedState(store, persistor) {
  store.dispatch({ type: ACTIONS.SET_DRAFT_TRANSACTION_AMOUNT, data: { amount: '12.5' } });
  store.dispatch({ type: ACTIONS.SET_DRAFT_TRANSACTION_ADDRESS, data: { address: 'fixture-unsent-address' } });
  await persistor.flush();
  const serialized = JSON.parse(await localForage.getItem('persist:v0'));
  const decompress = createCompressor();
  const saved = (key) => decompress.out(JSON.parse(serialized[key]), key);
  const receiveAddress = store.getState().wallet.receiveAddress;
  assert.deepEqual(
    saved('wallet'),
    receiveAddress === undefined ? {} : { receiveAddress },
    'Balances, sync completion and unsent transactions must not be persisted'
  );
  assert.equal(saved('app').daemonReady, undefined);
  assert.equal(saved('settings').loadedLanguages, undefined);
  assert.equal(saved('settings').language, undefined);
  for (const key of ['user', 'router', 'sync']) assert.equal(serialized[key], undefined);
  assert.deepEqual(saved('content').positions, store.getState().content.positions);
  assert.deepEqual(saved('subscriptions').subscriptions, store.getState().subscriptions.subscriptions);
  assert.equal(store.getState().wallet.draftTransaction.amount, 12.5, 'Persistence must not mutate live state');
}
