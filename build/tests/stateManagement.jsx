import { strict as assert } from 'assert';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider, connect } from 'react-redux';
import localForage from 'localforage';
import createCompressor from 'util/persist-compressor';
import * as ACTIONS from 'constants/action_types';
import { selectClaimsById, selectClaimForUri } from 'redux/selectors/claims';
import { selectSubscriptions } from 'redux/selectors/subscriptions';
import {
  selectMyPublishedCollections,
  selectMyPublishedMixedCollections,
  selectMyPublishedPlaylistCollections,
} from 'redux/selectors/collections';
import { doLocalCollectionCreate } from 'redux/actions/collections';
import { doToast } from 'redux/actions/notifications';
import { collectionsReducer } from 'redux/reducers/collections';
import { tick, waitFor } from './helpers';

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

  const resolved = Object.freeze({ id: 'mine', type: 'playlist', name: 'Published' });
  const pendingCollection = Object.freeze({ ...resolved, name: 'Pending' });
  const edited = Object.freeze({ ...resolved, name: 'Edited' });
  const mixed = Object.freeze({ id: 'mixed', type: 'collection', name: 'Mixed' });
  const collections = {
    claims: { myCollectionClaims: ['mine', 'mixed'] },
    collections: {
      resolved: Object.freeze({ mine: resolved, mixed, other: { id: 'other' } }),
      pending: Object.freeze({ mine: pendingCollection }),
      edited: Object.freeze({}),
    },
  };
  assert.deepEqual(selectMyPublishedCollections(collections), { mine: pendingCollection, mixed });
  assert.deepEqual(selectMyPublishedMixedCollections(collections), { mixed });
  assert.deepEqual(selectMyPublishedPlaylistCollections(collections), { mine: pendingCollection });
  assert.deepEqual(
    selectMyPublishedCollections({
      ...collections,
      collections: { ...collections.collections, edited: { mine: edited } },
    }),
    { mine: edited, mixed }
  );
  assert.equal(collections.collections.resolved.mine, resolved, 'Collection overlays must not mutate stored data');
  assert.deepEqual(
    selectMyPublishedCollections({
      claims: { myCollectionClaims: [] },
      collections: { resolved: {}, pending: {}, edited: {} },
    }),
    {}
  );

  const actions = [];
  const dispatch = (action) => {
    actions.push(action);
    return action;
  };
  doLocalCollectionCreate('Private playlist', ['lbry://fixture#abc'], 'playlist')(dispatch);
  doLocalCollectionCreate('Second playlist', [], 'playlist')(dispatch);
  const first = actions[0].data.entry;
  const second = actions[1].data.entry;
  const toast = doToast({ message: 'Fixture notification' });
  const ids = [first.id, second.id, toast.data.id];
  assert.equal(new Set(ids).size, 3, 'Collections and notifications must get distinct IDs');
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const created = actions.reduce(collectionsReducer, undefined);
  const restored = JSON.parse(JSON.stringify(created));
  assert.deepEqual(restored.unpublished[first.id].items, ['lbry://fixture#abc']);
  assert.equal(restored.lastUsedCollection, second.id, 'Generated IDs must survive collection persistence');
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
  const root = createRoot(container);
  root.render(
    <Provider store={store}>
      <Rows />
    </Provider>
  );
  await waitFor(() => container.textContent === '40', 'Connected rows must render with a modern root');
  assert.equal(container.textContent, '40');
  store.dispatch(position(50));
  await tick();
  assert.equal(container.textContent, '50');
  store.dispatch(clear);
  await tick();
  assert.equal(container.textContent, 'Removed', 'Parent subscriptions must update before removed children');
  root.unmount();
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
