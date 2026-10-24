/* eslint no-console:0 */
const assert = require('assert').strict;
const { load } = require('./testStartup');
const actions = load('constants/action_types.js', {});
const claimReducer = load('redux/reducers/claims.js', {
  'constants/action_types': actions,
  'util/merge-claim': load('util/merge-claim.js', {}).default,
}).claimsReducer;
const calls = [];
const events = [];
let state;
let fetchClaims;
const collections = load('redux/actions/collections.js', {
  'constants/action_types': actions,
  uuid: require('uuid'),
  lbry: {
    claim_search: async (params) => {
      calls.push(params);
      return fetchClaims(params);
    },
  },
  'redux/actions/claims': { doClaimSearch: () => () => {}, doAbandonClaim: () => () => {} },
  'redux/selectors/claims': { makeSelectClaimForClaimId: (id) => (state) => state.claims.byId[id] },
  'redux/selectors/collections': {
    makeSelectEditedCollectionForId: (id) => () => state.edited?.[id],
  },
  'constants/collections': {},
});
const dispatch = (action) => {
  if (typeof action === 'function') return action(dispatch, () => state);
  events.push(action);
  state = { ...state, claims: claimReducer(state.claims, action) };
  return action;
};
function claim(id, type = 'stream') {
  return {
    claim_id: id,
    name: id,
    value_type: type,
    canonical_url: 'lbry://' + id,
    permanent_url: 'lbry://' + id,
    timestamp: 10,
    meta: {},
    value: { title: id, stream_type: 'video' },
  };
}
async function main() {
  const video = claim('video');
  const audio = { ...claim('audio'), value: { stream_type: 'audio' } };
  const collection = { ...claim('collection', 'collection'), value: { claims: ['video', 'missing', 'audio'] } };
  state = { claims: { ...claimReducer(undefined, { type: '@@init' }), byId: { collection } } };
  fetchClaims = async ({ claim_ids }) => ({
    items: [audio, video].filter((item) => claim_ids.includes(item.claim_id)),
  });
  await dispatch(collections.doFetchItemsInCollections({ collectionIds: ['collection'], pageSize: 2 }));
  assert.equal(
    state.claims.byId.video,
    video,
    'Resolved collection items must populate the claim cache by their claim ID'
  );
  assert.equal(state.claims.byId.audio, audio);
  assert.deepEqual(JSON.parse(JSON.stringify(events.at(-1).data.resolvedCollections.collection.items)), [
    'lbry://video',
    'lbry://audio',
  ]);
  assert.equal(events.at(-1).data.resolvedCollections.collection.type, 'playlist');
  assert.deepEqual(
    calls.map((params) => params.page_size),
    [2, 2]
  );
  assert.equal(
    events.some(
      (event) =>
        event.type === actions.RESOLVE_URIS_COMPLETED &&
        Object.keys(event.data.resolveInfo).some((key) => /^\d+$/.test(key))
    ),
    false
  );

  const channel = { ...claim('@channel', 'channel'), value: {} };
  const repost = { ...claim('repost', 'repost'), value: {}, reposted_claim: video };
  const nested = { ...claim('nested', 'collection'), value: { claims: [] } };
  const mixed = {
    ...collection,
    claim_id: 'mixed',
    timestamp: undefined,
    value: { claims: ['@channel', 'repost', 'nested'] },
  };
  const broken = { ...collection, claim_id: 'broken', value: { claims: ['unavailable'] } };
  state = {
    claims: { ...state.claims, byId: { ...state.claims.byId, mixed, broken, video } },
    edited: { mixed: { updatedAt: 20 } },
  };
  fetchClaims = async ({ claim_ids }) => {
    if (claim_ids.includes('unavailable')) throw Error('fixture hub failure');
    return { items: [nested, repost, channel].filter((item) => claim_ids.includes(item.claim_id)) };
  };
  const before = events.length;
  await dispatch(collections.doFetchItemsInCollections({ collectionIds: ['mixed', 'broken', 'video', 'missing'] }));
  const result = events.at(-1).data;
  assert.deepEqual(JSON.parse(JSON.stringify(result.failedCollectionIds)).sort(), ['broken', 'missing', 'video']);
  assert.equal(result.resolvedCollections.mixed.type, 'collection');
  assert.equal(result.resolvedCollections.mixed.updatedAt, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(result.resolvedCollections.mixed.items)), [
    'lbry://@channel',
    'lbry://repost',
    'lbry://nested',
  ]);
  for (const item of [channel, repost, nested]) assert.equal(state.claims.byId[item.claim_id], item);
  assert.equal(
    events.slice(before).some((event) => event.type === actions.COLLECTION_DELETE),
    false,
    'An unconfirmed claim must retain newer local edits'
  );
  const channelUri = channel.canonical_url;
  const cached = { ...state.claims, channelClaimCounts: { [channelUri]: 17 } };
  const refreshed = claimReducer(cached, { type: actions.FETCH_CHANNEL_LIST_COMPLETED, data: { claims: [channel] } });
  assert.equal(refreshed.channelClaimCounts[channelUri], 17, 'Missing channel metadata must preserve the cached count');
  const emptyChannel = claimReducer(refreshed, {
    type: actions.FETCH_CHANNEL_LIST_COMPLETED,
    data: { claims: [{ ...channel, meta: { claims_in_channel: 0 } }] },
  });
  assert.equal(emptyChannel.channelClaimCounts[channelUri], 0, 'An explicit zero must replace the cached count');
  console.log('PASS collection fetch ordering, batching, partial failure, pending edits and resolved claim cache');
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
