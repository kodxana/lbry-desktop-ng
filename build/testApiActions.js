/* eslint no-console:0 */
const assert = require('assert').strict;
const { load } = require('./testStartup');
const actions = load('constants/action_types.js', {});
const uri = load('util/lbryURI.js', {}, { URLSearchParams });
const plain = (value) => JSON.parse(JSON.stringify(value));
const events = [];
const calls = [];
let state = {};
const sdk = {};
const api = {};
const dispatch = (action) => (typeof action === 'function' ? action(dispatch, () => state) : events.push(action));
const selectors = {
  selectResolvingUris: (state) => state.resolving || [],
  selectClaimsByUri: (state) => state.claims || {},
  selectMyChannelClaims: (state) => state.channels,
};
const notifications = { doToast: (data) => ({ type: 'toast', data }) };
const claims = load('redux/actions/claims.js', {
  'constants/action_types': actions,
  'constants/abandon_states': {},
  lbry: sdk,
  'util/lbryURI': uri,
  'redux/actions/notifications': notifications,
  'redux/selectors/claims': selectors,
  'redux/actions/wallet': {},
  'redux/selectors/wallet': {},
  'util/format-credits': {},
  'util/batch-actions': {},
  'util/claim': {},
  'constants/claim': {},
  'redux/selectors/collections': {},
  'redux/actions/collections': { doFetchItemsInCollections: (data) => ({ type: 'collections', data }) },
});
const comments = load(
  'redux/actions/comments.js',
  {
    'constants/action_types': actions,
    'constants/reactions': {},
    'constants/pages': {},
    'constants/comment': load('constants/comment.js', {}),
    lbry: sdk,
    'util/lbryURI': uri,
    'redux/selectors/claims': selectors,
    'redux/actions/claims': {},
    'redux/actions/notifications': notifications,
    'redux/selectors/comments': { selectModerationDelegatorsById: (state) => state.delegators || {} },
    'redux/selectors/notifications': { makeSelectNotificationForCommentId: () => () => null },
    'redux/selectors/app': { selectActiveChannelClaim: (state) => state.active },
    'util/hex': { toHex: (value) => Buffer.from(value).toString('hex') },
    comments: api,
    'redux/selectors/sync': { selectPrefsReady: () => true },
    'redux/actions/app': {},
  },
  { setTimeout }
);

async function resolveClaims() {
  const channel = { value_type: 'channel', claim_id: 'channel', meta: { claims_in_channel: 8 } };
  const stream = { value_type: 'stream', claim_id: 'stream', signing_channel: channel };
  const repost = { value_type: 'repost', claim_id: 'repost', reposted_claim: { permanent_url: 'lbry://original' } };
  const collection = { value_type: 'collection', claim_id: 'collection' };
  const censor = { claim_id: 'censor' };
  const response = Object.freeze({
    'lbry://channel': channel,
    'lbry://stream': stream,
    'lbry://repost': repost,
    'lbry://collection': collection,
    'lbry://missing': { error: 'not found' },
    'lbry://blocked': { error: { censor } },
  });
  const before = JSON.stringify(response);
  sdk.resolve = async (params) => {
    calls.push(plain(params));
    return params.urls[0] === 'lbry://original' ? { 'lbry://original': stream } : response;
  };
  await dispatch(claims.doResolveUris(Object.keys(response)));
  const result = events.find((event) => event.type === actions.RESOLVE_URIS_COMPLETED).data.resolveInfo;
  assert.equal(result['lbry://stream'].stream, stream);
  assert.equal(result['lbry://stream'].channel, channel);
  assert.equal(result['lbry://channel'].claimsInChannel, 8);
  assert.equal(result['lbry://repost'].stream, repost);
  assert.equal(result['lbry://original'].stream, stream);
  assert.equal(result['lbry://collection'].collection, collection);
  assert.equal(result['lbry://missing'].stream, null);
  assert.equal(result['lbry://blocked'].errorCensor, censor);
  assert.deepEqual(plain(events.at(-1)), { type: 'collections', data: { collectionIds: ['collection'], pageSize: 5 } });
  assert.deepEqual(calls[1], { urls: ['lbry://original'], include_purchase_receipt: true });
  assert.equal(JSON.stringify(response), before);
  state = { resolving: ['lbry://stream'], claims: { 'lbry://channel': channel } };
  const count = calls.length;
  await dispatch(claims.doResolveUris(['lbry://stream', 'lbry://channel'], true));
  assert.equal(calls.length, count, 'Cached and pending claims must not trigger duplicate requests');
}

async function signedComments() {
  const active = { name: '@owner', claim_id: 'owner' };
  const signed = Object.freeze({ signature: 'signed', signing_ts: '123', comment_id: 'must-not-replace-request' });
  state = { active, claims: { 'lbry://@owner': active } };
  sdk.channel_sign = async () => signed;
  api.comment_abandon = async (params) => {
    calls.push(plain(params));
    return { abandoned: true };
  };
  await dispatch(comments.doCommentAbandon('target', 'lbry://@owner'));
  assert.deepEqual(calls.at(-1), {
    comment_id: 'target',
    signature: 'signed',
    signing_ts: '123',
    creator_channel_id: 'owner',
    creator_channel_name: '@owner',
  });
  assert.equal(events.at(-1).type, actions.COMMENT_ABANDON_COMPLETED);
  state.active = null;
  await dispatch(comments.doCommentAbandon('unsigned'));
  assert.deepEqual(calls.at(-1), { comment_id: 'unsigned' });
  state.active = active;
  sdk.channel_sign = async () => {
    throw Error('cannot sign');
  };
  await dispatch(comments.doCommentAbandon('signing-failed'));
  assert.deepEqual(calls.at(-1), { comment_id: 'signing-failed' });
  sdk.channel_sign = async () => signed;
  api.comment_create = async (params) => {
    calls.push(plain(params));
    return { comment_id: 'created' };
  };
  await dispatch(comments.doCommentCreate('body', 'claim', 'parent', 'lbry://claim', 'tx', 'payment', 'test', true));
  assert.deepEqual(calls.at(-1), {
    comment: 'body',
    claim_id: 'claim',
    channel_id: 'owner',
    channel_name: '@owner',
    parent_id: 'parent',
    signature: 'signed',
    signing_ts: '123',
    sticker: true,
    support_tx_id: 'tx',
    payment_intent_id: 'payment',
    environment: 'test',
  });
  await dispatch(
    comments.doCommentCreate('body', 'claim', undefined, 'lbry://claim', undefined, undefined, undefined, false)
  );
  assert(!('support_tx_id' in calls.at(-1)));
  assert(!('payment_intent_id' in calls.at(-1)));
  api.setting_update = async (params) => {
    calls.push(plain(params));
  };
  await dispatch(
    comments.doUpdateCreatorSettings(active, { comments_enabled: false, channel_id: 'other', signature: 'other' })
  );
  assert.equal(calls.at(-1).channel_id, active.claim_id);
  assert.equal(calls.at(-1).signature, signed.signature);
  assert.equal(calls.at(-1).comments_enabled, false);
  assert.equal(signed.comment_id, 'must-not-replace-request');
}

async function moderation() {
  const target = 'lbry://@target#' + 'c'.repeat(40);
  const creator = 'lbry://@creator#' + 'd'.repeat(40);
  state = { channels: [{ name: '@owner', claim_id: 'owner' }] };
  api.moderation_block = api.moderation_unblock = async (params) => {
    calls.push(plain(params));
    return {};
  };
  await dispatch(comments.doCommentModUnBlockAsAdmin(target, 'owner'));
  assert.deepEqual(calls.at(-1), {
    mod_channel_id: 'owner',
    mod_channel_name: '@owner',
    signature: 'signed',
    signing_ts: '123',
    un_blocked_channel_id: 'c'.repeat(40),
    un_blocked_channel_name: 'target',
    global_un_block: true,
  });
  await dispatch(comments.doCommentModBlockAsModerator(target, creator, 'owner', 60));
  assert.equal(calls.at(-1).blocked_channel_id, 'c'.repeat(40));
  assert.equal(calls.at(-1).creator_channel_id, 'd'.repeat(40));
  assert.equal(calls.at(-1).time_out, 60);
  const count = calls.length;
  await dispatch(comments.doCommentModBlock('lbry://@unresolved'));
  assert.equal(calls.length, count, 'A moderation target without a claim ID must not be submitted');

  state.channels.push({ name: '@second', claim_id: 'second' });
  const blocked = {
    blocked_channel_name: '@target',
    blocked_channel_id: 'c'.repeat(40),
    blocked_at: '2026-01-01',
    banned_for: 60,
    ban_remaining: 30,
  };
  api.moderation_block_list = async ({ mod_channel_id }) => {
    if (mod_channel_id === 'owner') throw Error('first server result failed');
    return {
      blocked_channels: [blocked],
      delegated_blocked_channels: [
        blocked,
        { ...blocked, blocked_by_channel_name: '@creator', blocked_by_channel_id: 'd'.repeat(40) },
      ],
    };
  };
  await dispatch(comments.doFetchModBlockedList());
  assert.equal(events.at(-1).type, actions.COMMENT_MODERATION_BLOCK_LIST_COMPLETED);
  const result = plain(events.at(-1).data);
  assert.deepEqual(result.personalBlockList, [target]);
  assert.deepEqual(result.moderatorBlockList, [target]);
  assert.deepEqual(result.moderatorBlockListDelegatorsMap, { [target]: [creator] });
  assert.equal(result.personalTimeoutMap[target].banRemaining, 30);
  api.moderation_am_i = async ({ channel_id }) => {
    if (channel_id === 'owner') throw Error('first result failed');
    return { channel_id, type: 'Global', authorized_channels: { '@creator': 'd'.repeat(40) } };
  };
  await dispatch(comments.doFetchCommentModAmIList(state.channels[1]));
  assert.deepEqual(plain(events.at(-1).data), { second: { global: true, delegators: { '@creator': 'd'.repeat(40) } } });
}

async function main() {
  await resolveClaims();
  await signedComments();
  await moderation();
  console.log('PASS claim resolution, signed comment payloads, moderation requests and partial results');
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
