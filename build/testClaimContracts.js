/* eslint no-console:0 */
const assert = require('assert').strict;
const { load } = require('./testStartup');
const reselect = require('reselect');
const cached = require('re-reselect');
const plain = (value) => JSON.parse(JSON.stringify(value));
const uri = load('util/lbryURI.js', {}, { URLSearchParams });
const tags = load('constants/tags.js', {});
const helpers = load('util/claim.js', { 'constants/tags': tags, 'util/lbryURI': uri });
const constants = load('constants/claim.js', { 'constants/tags': tags });
const actions = load('constants/action_types.js', {});
const reducer = load('redux/reducers/claims.js', {
  'constants/action_types': actions,
  'util/merge-claim': load('util/merge-claim.js', {}).default,
}).claimsReducer;
let currentState;
const wallet = { selectSupportsByOutpoint: (state) => state.supports || {} };
const claims = load(
  'redux/selectors/claims.js',
  {
    reselect,
    're-reselect': cached,
    'util/lbryURI': uri,
    'util/claim': helpers,
    'constants/claim': constants,
    'redux/selectors/wallet': wallet,
    lbryinc: { selectBlackListedOutpoints: (state) => state.blacklist || [] },
  },
  { window: { store: { getState: () => currentState } } }
);
function state() {
  return { claims: reducer(undefined, { type: '@@init' }), supports: {}, mature: true };
}
function claim(name, letter, valueType = 'stream', overrides = {}) {
  return {
    claim_id: letter.repeat(40),
    name,
    normalized_name: name,
    value_type: valueType,
    canonical_url: 'lbry://' + name + '#' + letter.repeat(40),
    permanent_url: 'lbry://' + name + '#' + letter.repeat(40),
    short_url: 'lbry://' + name + '#' + letter,
    txid: letter.repeat(64),
    nout: 0,
    amount: '1',
    height: 10,
    timestamp: 10,
    is_my_output: false,
    meta: { effective_amount: '1', support_amount: '0', creation_timestamp: 1 },
    value: { title: name, tags: [], stream_type: 'video', source: { media_type: 'video/mp4' } },
    ...overrides,
  };
}
function add(result, item) {
  result.claims = {
    ...result.claims,
    byId: { ...result.claims.byId, [item.claim_id]: item },
    claimsByUri: { ...result.claims.claimsByUri, [uri.normalizeURI(item.canonical_url)]: item.claim_id },
  };
  return item;
}

async function main() {
  let empty = state();
  assert.equal(claims.selectClaimForUri(empty, 'lbry://missing'), undefined);
  assert.equal(claims.makeSelectClaimForUri('not a valid uri')(empty), undefined);
  empty = { ...empty, claims: { ...empty.claims, claimsByUri: { 'lbry://missing': null } } };
  for (const select of [claims.selectClaimForUri, (state, url) => claims.makeSelectClaimForUri(url)(state)]) {
    assert.equal(select(empty, 'lbry://missing'), null);
    assert.equal(select(empty, 'lbry://unfetched'), undefined);
  }
  assert.equal(claims.selectMetadataForUri(empty, 'lbry://missing'), null);
  assert.equal(claims.selectMetadataForUri(empty, 'lbry://unfetched'), undefined);
  assert.equal(claims.selectClaimWithId(empty, 'missing'), undefined);
  assert.equal(claims.selectClaimIsMine(empty, null), false);
  assert.equal(claims.selectMyClaimsRaw(empty), undefined);
  assert.equal(claims.selectMyChannelClaims(empty), undefined);
  assert.deepEqual(plain(claims.selectPendingIds(empty)), []);
  assert.equal(claims.makeSelectReflectingClaimForUri('lbry://missing')(empty), undefined);
  assert.equal(claims.selectMyClaimsPageNumber(empty), 1);
  assert.equal(claims.selectMyClaimsPageNumber({ ...empty, claims: { ...empty.claims, myClaimsPageNumber: 3 } }), 3);

  const populated = state();
  const channel = add(
    populated,
    claim('@owner', 'c', 'channel', {
      value: {
        title: 'Owner',
        public_key: 'fixture',
        public_key_id: 'fixture',
        email: 'owner@example.invalid',
        website_url: 'https://example.invalid',
        cover: { url: ' http://example.invalid/cover ' },
        thumbnail: { url: 'http://example.invalid/avatar' },
        tags: ['channel-tag'],
      },
    })
  );
  const video = add(
    populated,
    claim('video', 'a', 'stream', {
      is_my_output: true,
      signing_channel: channel,
      is_channel_signature_valid: true,
      value: {
        title: 'A video',
        stream_type: 'video',
        source: { media_type: 'video/mp4' },
        thumbnail: { url: ' http://example.invalid/video ' },
        release_time: 12,
        languages: ['en'],
        tags: ['video-tag'],
      },
    })
  );
  const repost = add(
    populated,
    claim('reposted', 'b', 'repost', {
      value: { claim_id: video.claim_id },
      reposted_claim: video,
      signing_channel: channel,
      meta: { effective_amount: '2', support_amount: '0' },
    })
  );
  const before = JSON.stringify(populated);
  for (const select of [
    claims.selectClaimForUri,
    (state, url, unwrap) => claims.makeSelectClaimForUri(url, unwrap)(state),
  ]) {
    assert.equal(select(populated, video.canonical_url), video);
    assert.equal(select(populated, repost.canonical_url, false), repost);
    const unwrapped = select(populated, repost.canonical_url, true);
    assert.equal(unwrapped.claim_id, video.claim_id);
    assert.equal(unwrapped.repost_bid_amount, '2');
    assert.equal(unwrapped.repost_url, uri.normalizeURI(repost.canonical_url));
    assert.equal(unwrapped.repost_channel_url, channel.canonical_url);
  }
  assert.equal(
    claims.selectClaimForUri(populated, repost.canonical_url, false),
    repost,
    'Repost cache keys must separate raw and unwrapped lookups'
  );
  assert.equal(claims.makeSelectMetadataItemForUri(channel.canonical_url, 'email')(populated), 'owner@example.invalid');
  assert.equal(claims.makeSelectMetadataItemForUri(video.canonical_url, 'email')(populated), undefined);
  assert.deepEqual(plain(claims.makeSelectMetadataItemForUri(video.canonical_url, 'languages')(populated)), ['en']);
  assert.equal(claims.selectThumbnailForUri(populated, video.canonical_url), 'https://example.invalid/video');
  assert.equal(claims.makeSelectCoverForUri(video.canonical_url)(populated), 'https://example.invalid/cover');
  assert.equal(claims.makeSelectAvatarForUri(channel.canonical_url)(populated), 'https://example.invalid/avatar');
  assert.equal(claims.makeSelectContentTypeForUri(channel.canonical_url)(populated), undefined);
  assert.equal(claims.makeSelectContentTypeForUri(video.canonical_url)(populated), 'video/mp4');
  assert.equal(claims.selectDateForUri(populated, video.canonical_url).getTime(), 12000);
  assert.equal(claims.makeSelectTagInClaimOrChannelForUri(video.canonical_url, 'channel-tag')(populated), true);
  assert.equal(claims.makeSelectChannelForClaimUri(video.canonical_url, true)(populated), channel.canonical_url);
  assert.equal(JSON.stringify(populated), before, 'Reading claims and reposts must preserve stored data');

  const pending = {
    ...populated,
    claims: {
      ...populated.claims,
      pendingById: { [video.claim_id]: { ...video, amount: '3' } },
      myClaims: [video.claim_id, channel.claim_id],
      abandoningById: { [channel.claim_id]: true },
      myChannelClaims: [channel.claim_id, 'missing'],
    },
  };
  currentState = pending;
  assert.equal(claims.selectClaimForUri(pending, video.canonical_url).amount, '3');
  assert.equal(claims.makeSelectClaimIsPending(video.canonical_url)(pending), true);
  assert.equal(claims.makeSelectPendingClaimForUri('lbry://video')(pending).claim_id, video.claim_id);
  assert.equal(claims.selectMyActiveClaims(pending).has(video.claim_id), true);
  assert.equal(claims.selectMyActiveClaims(pending).has(channel.claim_id), false);
  assert.equal(claims.selectClaimIsMine(pending, channel), false);
  assert.equal(
    claims.selectMyChannelClaims(pending).length,
    1,
    'Stale owned IDs must not create undefined channel entries'
  );
  const resolvedMissing = reducer(pending.claims, {
    type: actions.RESOLVE_URIS_COMPLETED,
    data: { resolveInfo: { [uri.normalizeURI(video.canonical_url)]: {} } },
  });
  assert.equal(
    resolvedMissing.claimsByUri[uri.normalizeURI(video.canonical_url)],
    video.claim_id,
    'A missing resolve result must retain a pending claim'
  );

  const lists = state();
  const older = add(lists, claim('older', 'd'));
  const newer = add(lists, claim('newer', 'e', 'stream', { timestamp: 20 }));
  lists.claims.myClaims = [newer.claim_id, older.claim_id];
  const oldestFirst = claims.selectMyClaimsWithoutChannels(lists);
  assert.deepEqual(oldestFirst.map((item) => item.claim_id).join(), [older.claim_id, newer.claim_id].join());
  Object.freeze(oldestFirst);
  assert.deepEqual(plain(claims.selectMyClaimUrisWithoutChannels(lists)), [newer.canonical_url, older.canonical_url]);
  assert.equal(claims.selectMyClaimsWithoutChannels(lists), oldestFirst);
  assert.equal(oldestFirst[0], older, 'Newest-first URL sorting must not reorder the cached oldest-first claim list');
  lists.claims = {
    ...lists.claims,
    myPurchases: [older.canonical_url, 'lbry://unfetched', 'lbry://missing', older.canonical_url],
    claimsByUri: { ...lists.claims.claimsByUri, 'lbry://missing': null },
  };
  assert.deepEqual(plain(claims.makeSelectMyPurchasesForPage(null)(lists)), [
    older.canonical_url,
    'lbry://unfetched',
    'lbry://missing',
  ]);
  assert.deepEqual(plain(claims.makeSelectMyPurchasesForPage('older')(lists)), [
    older.canonical_url,
    older.canonical_url,
  ]);
  assert.deepEqual(plain(claims.makeSelectMyPurchasesForPage('older', 2)(lists)), []);
  lists.claims.paginatedClaimsByChannel[channel.canonical_url] = {
    1: [older.claim_id, 'missing'],
    itemCount: 2,
    pageCount: 1,
  };
  assert.equal(claims.makeSelectClaimsInChannelForPage(channel.canonical_url)(lists)[1], undefined);
  assert.equal(claims.makeSelectTotalClaimsInChannelSearch(channel.canonical_url)(lists), 2);
  populated.supports = { a: { claim_id: video.claim_id, amount: '0.00000001' }, b: { claim_id: 'other', amount: '9' } };
  assert.equal(claims.makeSelectSupportsForUri(video.canonical_url)(populated), 0.00000001);

  const search = load('redux/selectors/search.js', {
    reselect,
    're-reselect': cached,
    'redux/selectors/claims': claims,
    'util/lbryURI': uri,
    'util/claim': helpers,
    'util/query-params': {},
    'constants/search': {},
    'util/search': {},
    'redux/selectors/settings': { selectShowMatureContent: (state) => state.mature },
    'redux/selectors/blocked': { selectMutedChannels: () => [] },
    'redux/selectors/content': { selectHistory: () => [] },
    lbryinc: { selectAllCostInfoByUri: () => ({}) },
  });
  for (const [streamAmount, channelAmount, pendingAmount, winner] of [
    ['2', '3', '10', 'pending'],
    ['10', '2', '3', 'stream'],
    ['0.00000001', '0.00000002', '0.00000003', 'pending'],
    ['2', '3', '3', 'channel'],
  ]) {
    const bids = state();
    const stream = add(bids, claim('target', 'a', 'stream', { meta: { effective_amount: streamAmount } }));
    const owner = add(
      bids,
      claim('@target', 'b', 'channel', { meta: { effective_amount: channelAmount }, value: { tags: [] } })
    );
    const pendingClaim = claim('target', 'c', 'stream', { amount: pendingAmount });
    bids.claims.claimsByUri['lbry://target'] = stream.claim_id;
    bids.claims.claimsByUri['lbry://@target'] = owner.claim_id;
    bids.claims.pendingById[pendingClaim.claim_id] = pendingClaim;
    assert.equal(
      search.makeSelectWinningUriForQuery('target')(bids),
      { pending: pendingClaim, stream, channel: owner }[winner].permanent_url
    );
  }
  for (const value of [null, undefined, channel, repost]) assert.equal(helpers.isClaimPlayable(value), false);
  assert.equal(helpers.isClaimPlayable(video), true);
  console.log(
    'PASS: claim resolution states, reposts, pending precedence, ownership, metadata, pagination, immutable lists, purchases and numeric pending bids'
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
