/* eslint no-console:0 */
const assert = require('assert').strict;
const { load } = require('./testStartup');
const actions = load('constants/action_types.js', {});
const calls = [];
const events = [];
let response;
let failure;
const sdk = Object.fromEntries(
  ['stream_repost', 'collection_create', 'collection_update'].map((method) => [
    method,
    async (params) => {
      calls.push({ method, params });
      if (failure) throw failure;
      return response;
    },
  ])
);
sdk.collection_list = async (params) => {
  calls.push({ method: 'collection_list', params });
  return { items: [{ claim_id: 'collection' }] };
};
const claims = load('redux/actions/claims.js', {
  'constants/action_types': actions,
  'constants/abandon_states': {},
  'constants/claim': {},
  lbry: sdk,
  'util/lbryURI': {},
  'util/claim': {},
  'util/format-credits': load('util/format-credits.js', { './intlNumberFormat': {} }),
  'util/batch-actions': load('util/batch-actions.js', {}),
  'redux/actions/notifications': {},
  'redux/actions/wallet': {},
  'redux/selectors/wallet': {},
  'redux/selectors/claims': {},
  'redux/selectors/collections': { makeSelectClaimIdsForCollectionId: () => () => ['original', 'next'] },
  'redux/actions/collections': { doFetchItemsInCollections: (options) => ({ type: 'fetch-items', options }) },
});
// Record follow-up thunks without starting the pending-claim poll or another SDK call.
const dispatch = (action) => {
  if (action.type === 'BATCH_ACTIONS') action.actions.forEach(dispatch);
  else events.push(action);
  return action;
};
const plain = (value) => JSON.parse(JSON.stringify(value));
async function settle(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(Error('SDK failure left the caller waiting')), 1000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function main() {
  const options = {
    name: 'fixture',
    bid: '1.00000001',
    claims: ['original'],
    claim_id: 'collection',
    channel_id: 'owner',
    blocking: true,
    tags: [{ name: 'test' }],
    languages: ['en'],
  };
  for (const [method, action, started, completed, failed] of [
    [
      'stream_repost',
      () => claims.doRepost(options),
      actions.CLAIM_REPOST_STARTED,
      actions.CLAIM_REPOST_COMPLETED,
      actions.CLAIM_REPOST_FAILED,
    ],
    [
      'collection_create',
      () => claims.doCollectionPublish(options, 'local'),
      actions.COLLECTION_PUBLISH_STARTED,
      actions.COLLECTION_PUBLISH_COMPLETED,
      actions.COLLECTION_PUBLISH_FAILED,
    ],
    [
      'collection_update',
      () => claims.doCollectionPublishUpdate(options),
      actions.COLLECTION_PUBLISH_UPDATE_STARTED,
      actions.COLLECTION_PUBLISH_UPDATE_COMPLETED,
      actions.COLLECTION_PUBLISH_UPDATE_FAILED,
    ],
  ]) {
    events.length = 0;
    failure = Error('fixture rejection');
    assert.equal(await settle(action()(dispatch, () => ({}))), undefined);
    assert.deepEqual(
      events.map((event) => event.type),
      [started, failed]
    );
    assert.equal(events.at(-1).data.error, failure.message);
    assert.equal(calls.at(-1).method, method);
    assert.equal(calls.at(-1).params.bid, '1.00000001');
    assert.equal(calls.at(-1).params.channel_id, 'owner');
    failure = undefined;
    const claim = { claim_id: 'published', value_type: method === 'stream_repost' ? 'repost' : 'collection' };
    response = { outputs: [claim, { type: 'payment', amount: '0.001' }] };
    events.length = 0;
    assert.equal(
      await settle(action()(dispatch, () => ({}))),
      claim,
      'Return the claim output, not transaction change'
    );
    assert(events.some((event) => event.type === completed));
    assert(events.some((event) => event.type === actions.UPDATE_PENDING_CLAIMS && event.data.claims[0] === claim));
    if (method !== 'stream_repost') {
      assert.deepEqual(plain(calls.at(-1).params.tags), ['test']);
      assert.deepEqual(plain(calls.at(-1).params.claims), ['original']);
    }
  }
  await claims.doCollectionPublishUpdate({ claim_id: 'collection' }, true)(dispatch, () => ({}));
  assert.deepEqual(
    plain(calls.at(-1).params),
    { blocking: true, claim_id: 'collection', clear_claims: true, claims: ['original', 'next'] },
    'Background edits must not replace metadata or alter the bid'
  );
  claims.doFetchCollectionListMine(2, 10)(dispatch);
  await Promise.resolve();
  assert.deepEqual(plain(events.at(-1).options), { collectionIds: ['collection'], pageSize: 5 });
  console.log(
    'PASS repost/collection settlement, first transaction output, precise bids, channel identity and background edit parameters'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
