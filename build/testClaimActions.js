/* eslint no-console:0 */
const assert = require('assert').strict;
const { load } = require('./testStartup');
const plain = (value) => JSON.parse(JSON.stringify(value));
const actions = load('constants/action_types.js', {});
const uri = load('util/lbryURI.js', {}, { URLSearchParams });
const notifications = { doToast: (data) => ({ type: 'toast', data }) };
const selectors = {
  selectClaimForUri: (state) => state.claim,
  makeSelectClaimForUri: () => (state) => state.claim,
  selectMyClaimsRaw: (state) => state.myClaims,
  selectMyChannelClaims: (state) => state.channels,
  selectClaimIsMine: (state, claim) => Boolean(claim.is_my_output),
};
const item = { claim_id: 'a'.repeat(40), name: 'video', txid: 'b'.repeat(64), nout: 2, value_type: 'stream' };
const url = 'lbry://video#' + item.claim_id;
const outpoint = item.txid + ':2';
let state = {};
const events = [];
const getState = () => state;
const dispatch = (action) => (typeof action === 'function' ? action(dispatch, getState) : events.push(action));
const content = load('redux/actions/content.js', {
  'constants/action_types': actions,
  'constants/modal_types': {},
  'constants/settings': {},
  'util/desktop': {},
  'util/download-notifications': {},
  'redux/actions/app': {},
  'redux/selectors/claims': selectors,
  'redux/selectors/file_info': {},
  'redux/selectors/collections': {},
  'redux/actions/notifications': notifications,
  'redux/actions/file': {},
  lbry: {},
  lbryinc: {},
  'redux/selectors/settings': { makeSelectClientSetting: () => (state) => state.persist },
});
const calls = [];
const reactions = load('redux/actions/reactions.js', {
  'constants/action_types': actions,
  'constants/reactions': load('constants/reactions.js', {}),
  'redux/selectors/claims': selectors,
  'redux/selectors/reactions': { makeSelectMyReactionForUri: () => () => undefined },
  lbryinc: { Lbryio: { call: async (...args) => calls.push(args) } },
});
const files = load('redux/actions/file.js', {
  'constants/action_types': actions,
  'constants/abandon_states': {},
  'util/desktop': {},
  lbry: {
    get: async (args) => {
      calls.push(args);
      return { outpoint };
    },
    file_delete: (args) => calls.push(args),
  },
  'redux/selectors/claims': selectors,
  'redux/actions/claims': {},
  'util/batch-actions': {
    batchActions:
      (...actions) =>
      (dispatch) =>
        actions.forEach(dispatch),
  },
  'redux/actions/app': { doHideModal: () => ({ type: 'hide' }) },
  'redux-first-history': {},
  'redux/actions/content': {},
  'redux/selectors/content': { selectPlayingUri: () => null },
  'redux/actions/notifications': notifications,
  'redux/selectors/wallet': {},
  'redux/selectors/file_info': { makeSelectFileInfoForUri: () => () => undefined },
});
const claims = load(
  'redux/actions/claims.js',
  {
    'constants/action_types': actions,
    'constants/abandon_states': load('constants/abandon_states.js', {}),
    lbry: {
      support_abandon: async (args) => calls.push(args),
      channel_update: async (args) => {
        calls.push(args);
        return { outputs: [state.channels[0]] };
      },
    },
    'util/lbryURI': uri,
    'redux/actions/notifications': notifications,
    'redux/selectors/claims': selectors,
    'redux/actions/wallet': { doFetchTxoPage: () => ({ type: 'refresh' }) },
    'redux/selectors/wallet': { selectSupportsByOutpoint: (state) => state.supports || {} },
    'util/format-credits': { creditsToString: String },
    'util/batch-actions': {},
    'util/claim': {},
    'constants/claim': {},
    'redux/selectors/collections': {},
    'redux/actions/collections': {},
  },
  { console: { error: () => {} } }
);
const signed = Object.freeze({ signature: 'fixture-signature', signing_ts: '123' });
const comments = load('redux/actions/comments.js', {
  'constants/action_types': actions,
  'constants/reactions': {},
  'constants/pages': {},
  'constants/comment': load('constants/comment.js', {}),
  lbry: {
    channel_sign: async (args) => {
      calls.push(args);
      if (args.channel_id === 'first') throw Error('fixture signing failure');
      return signed;
    },
  },
  'util/lbryURI': uri,
  'redux/selectors/claims': selectors,
  'redux/actions/claims': {},
  'redux/actions/notifications': notifications,
  'redux/selectors/comments': { selectModerationDelegatorsById: () => ({}) },
  'redux/selectors/notifications': {},
  'redux/selectors/app': {},
  'util/hex': { toHex: (value) => Buffer.from(value).toString('hex') },
  comments: {
    moderation_block: async (args) => {
      calls.push(args);
      throw Error('fixture moderation failure');
    },
  },
  'redux/selectors/sync': { selectPrefsReady: () => true },
  'redux/actions/app': {},
});

async function main() {
  for (const claim of [undefined, null]) {
    state = { claim };
    const count = events.length;
    content.savePosition(url, 12)(dispatch, getState);
    content.clearPosition(url)(dispatch, getState);
    await reactions.doReactionLike(url)(dispatch, getState);
    await reactions.doReactionDislike(url)(dispatch, getState);
    assert.equal(events.length, count, 'Unresolved content must not change playback or reaction state');
    files.doFileGet(url)(dispatch, getState);
    assert.equal(events.at(-1).type, 'toast');
    assert.equal(events.at(-1).data.isError, true);
    assert.equal(calls.length, 0, 'Unresolved content must not initiate a download or reaction');
  }
  state = { claim: item };
  content.savePosition(url, 12)(dispatch, getState);
  assert.deepEqual(plain(events.at(-1).data), { claimId: item.claim_id, outpoint, position: 12 });
  content.clearPosition(url)(dispatch, getState);
  assert.equal(events.at(-1).type, actions.CLEAR_CONTENT_POSITION);
  state.persist = true;
  content.clearPosition(url)(dispatch, getState);
  assert.equal(events.at(-1).data.position, null);
  await reactions.doReactionLike(url)(dispatch, getState);
  await reactions.doReactionDislike(url)(dispatch, getState);
  assert.equal(calls[0][2].claim_ids, item.claim_id);
  assert.equal(calls[1][2].claim_ids, item.claim_id);
  files.doFileGet(url, false)(dispatch, getState);
  await Promise.resolve();
  assert.deepEqual(plain(calls.at(-1)), { uri: url, save_file: false });
  assert.equal(events.at(-1).type, actions.FETCH_FILE_INFO_COMPLETED);
  state = {};
  files.doDeleteFileAndMaybeGoBack(url, false, false, undefined, item)(dispatch, getState);
  assert.deepEqual(
    plain(calls.at(-1)),
    { outpoint, delete_from_download_dir: false },
    'Deletion can use its explicit claim after the URI cache is cleared'
  );

  calls.length = 0;
  claims.doAbandonClaim(item)(dispatch, getState);
  assert.equal(calls.length, 0, 'An unknown outpoint must never be abandoned');
  state = { supports: { [outpoint]: { ...item, amount: '1' } } };
  claims.doAbandonClaim(item)(dispatch, getState);
  await Promise.resolve();
  assert.deepEqual(plain(calls), [{ txid: item.txid, nout: 2, blocking: true }]);
  assert(events.some((event) => event.type === actions.ABANDON_SUPPORT_COMPLETED));

  calls.length = 0;
  for (const channels of [undefined, []]) {
    state = { channels };
    await claims.doUpdateChannel({ claim_id: 'channel', amount: '1' })(dispatch, getState);
    assert.equal(calls.length, 0, 'Unloaded channel metadata must not be overwritten with empty locations');
    assert.equal(events.at(-2).type, actions.UPDATE_CHANNEL_FAILED);
  }
  const locations = [{ country: 'PL', city: 'Warsaw' }];
  state = { channels: [{ claim_id: 'channel', value: { locations } }] };
  // Inspect the queued pending-claim poll without starting its timer.
  await claims.doUpdateChannel({ claim_id: 'channel', amount: '1.00000001', tags: [{ name: 'tag' }] })(
    (action) => events.push(action),
    getState
  );
  assert.deepEqual(plain(calls[0].locations), locations);
  assert.deepEqual(plain(calls[0].tags), ['tag']);
  assert.equal(calls[0].bid, '1.00000001');

  const commenter = 'lbry://@target#' + 'c'.repeat(40);
  const creator = 'lbry://@creator#' + 'd'.repeat(40);
  state = {
    channels: [
      { claim_id: 'first', name: '@first' },
      { claim_id: 'second', name: '@second' },
    ],
  };
  calls.length = 0;
  await dispatch(comments.doCommentModBlockAsAdmin(commenter, ''));
  await dispatch(comments.doCommentModBlockAsModerator(commenter, creator, ''));
  assert.equal(calls.length, 0, 'Missing admin or moderator must not sign or submit a request');
  assert.equal(events.at(-1).data.isError, true);
  await dispatch(comments.doCommentModBlock(commenter));
  assert.equal(calls.length, 3);
  assert.equal(calls[2].mod_channel_id, 'second');
  assert.equal(calls[2].signature, signed.signature);
  assert(
    events.some((event) => event.type === 'toast' && event.data.message === '@second: fixture moderation failure'),
    'A failed signing request must not shift the identity attached to a subsequent moderation failure'
  );
  assert.equal(signed.claim_id, undefined, 'Signing responses must remain unchanged');
  assert.equal(events.at(-1).type, actions.COMMENT_MODERATION_BLOCK_FAILED);
  console.log(
    'PASS claim actions: unresolved downloads/reactions/playback, deletion fallback, safe support abandonment, channel metadata preservation and moderation identity'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
