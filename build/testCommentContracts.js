/* eslint no-console:0 */
const assert = require('assert').strict;
const { load } = require('./testStartup');
const reselect = require('reselect');
const cached = require('re-reselect');
const plain = (value) => JSON.parse(JSON.stringify(value));
const uri = load('util/lbryURI.js', {}, { URLSearchParams });
const claimHelpers = load('util/claim.js', {
  'constants/tags': load('constants/tags.js', {}),
  'util/lbryURI': uri,
});
const claims = load('redux/selectors/claims.js', {
  reselect,
  're-reselect': cached,
  'util/lbryURI': uri,
  'util/claim': claimHelpers,
  'constants/claim': load('constants/claim.js', { 'constants/tags': load('constants/tags.js', {}) }),
  'redux/selectors/wallet': { selectSupportsByOutpoint: () => ({}) },
  lbryinc: { selectBlackListedOutpoints: () => [] },
});
const constants = load('constants/comment.js', {});
const actions = load('constants/action_types.js', {});
const reducer = load('redux/reducers/comments.js', {
  'constants/action_types': actions,
  'constants/comment': constants,
  'util/redux-utils': load('util/redux-utils.js', {}),
  'util/lbryURI': uri,
}).default;
const selectors = load('redux/selectors/comments.js', {
  reselect,
  're-reselect': cached,
  'redux/selectors/claims': claims,
  'util/claim': claimHelpers,
  'redux/selectors/blocked': { selectMutedChannels: (state) => state.muted || [] },
  'redux/selectors/settings': { selectShowMatureContent: (state) => Boolean(state.mature) },
  'redux/selectors/search': {
    selectMentionSearchResults: (state) => state.search || [],
    selectMentionQuery: (state) => state.query || '',
  },
  'redux/selectors/subscriptions': { selectSubscriptionUris: (state) => state.subscriptions },
  lbryinc: {
    selectBlacklistedOutpointMap: (state) => state.blacklisted || {},
    selectFilteredOutpointMap: (state) => state.filtered || {},
  },
});
function state(overrides = {}) {
  return {
    muted: [],
    mature: false,
    search: [],
    query: '',
    blacklisted: {},
    filtered: {},
    claims: { byId: {}, pendingById: {}, claimsByUri: { video: 'content' }, myClaims: [], myChannelClaims: [] },
    comments: plain(reducer(undefined, { type: '@@init' })),
    ...overrides,
  };
}
const comment = (id, channel = id) => ({
  comment_id: id,
  channel_id: channel,
  channel_url: 'lbry://@' + channel + '#abc',
  claim_id: 'content',
  comment: 'hello',
  timestamp: 1,
  is_hidden: false,
  is_pinned: false,
  support_amount: 0,
  replies: 0,
  is_moderator: false,
  is_creator: false,
  is_global_mod: false,
});
const channel = (id, tags = []) => ({
  claim_id: id,
  value_type: 'channel',
  canonical_url: 'lbry://@' + id + '#abc',
  txid: id,
  nout: 0,
  value: { tags },
  is_my_output: false,
});
const ids = (comments) => comments.map((item) => item.comment_id);
for (const [selector, key] of [
  ['selectModerationBlockList', 'moderationBlockList'],
  ['selectAdminBlockList', 'adminBlockList'],
  ['selectModeratorBlockList', 'moderatorBlockList'],
]) {
  const original = Object.freeze(['old', 'new']);
  const first = state();
  first.comments[key] = original;
  assert.deepEqual(plain(selectors[selector](first)), ['new', 'old']);
  assert.deepEqual(original, ['old', 'new'], 'A selector must not reverse the stored moderation list');
  assert.strictEqual(
    selectors[selector](first),
    selectors[selector](first),
    'Unchanged inputs retain the cached result'
  );
  const refreshed = { ...first, comments: { ...first.comments, [key]: original.slice() } };
  assert.deepEqual(plain(selectors[selector](refreshed)), ['new', 'old'], 'Recomputation must not toggle list order');
  assert.deepEqual(plain(selectors[selector](state())), []);
}
const empty = state();
assert.equal(selectors.selectMyReactsForComment(empty, 'a:channel'), undefined);
assert.equal(selectors.selectOthersReactsForComment(empty, 'a'), undefined);
assert.equal(selectors.selectRepliesForParentId(empty, 'a'), null);
assert.equal(selectors.makeSelectCommentForCommentId('a')(empty), undefined);
assert.equal(selectors.makeSelectTotalCommentsCountForUri('video')(empty), 0);
assert.equal(selectors.makeSelectTotalReplyPagesForParentId('a')(empty), 0);
assert.equal(selectors.selectSuperChatTotalAmountForUri(empty, 'video'), 0);
assert.equal(selectors.selectSuperChatsForUri(empty, 'video'), undefined);
assert.equal(selectors.selectHasAdminChannel(empty), false);
assert.deepEqual(plain(selectors.selectCommentsForUri(empty, 'unresolved')), []);
assert.deepEqual(plain(selectors.selectTopLevelCommentsForUri(empty, 'unresolved')), []);
const populated = state();
populated.comments = reducer(populated.comments, {
  type: actions.COMMENT_LIST_COMPLETED,
  data: {
    comments: [comment('a'), comment('b')],
    totalItems: 12,
    totalFilteredItems: 9,
    totalPages: 3,
    claimId: 'content',
    uri: 'video',
    creatorClaimId: 'creator',
  },
});
populated.comments.commentById.c = comment('c');
populated.comments.byId.content.push('missing');
populated.comments.topLevelCommentsById.content.push('missing');
populated.comments.repliesByParentId.a = ['c', 'missing'];
populated.comments.pinnedCommentsById.content = ['missing', 'a'];
for (const [select, key] of [
  ['selectCommentsByClaimId', 'byId'],
  ['selectTopLevelCommentsByClaimId', 'topLevelCommentsById'],
  ['selectRepliesByParentId', 'repliesByParentId'],
]) {
  const map = selectors[select](populated);
  assert.deepEqual(
    plain(ids(map[key === 'repliesByParentId' ? 'a' : 'content'])),
    key === 'repliesByParentId' ? ['c'] : ['a', 'b']
  );
  const legacy = { ...populated, comments: { ...populated.comments, [key]: { legacy: null } } };
  assert.deepEqual(plain(selectors[select](legacy).legacy), [], 'A legacy empty list must not crash rendering');
}
assert.deepEqual(plain(ids(selectors.selectPinnedCommentsForUri(populated, 'video'))), ['a']);
assert.deepEqual(plain(ids(selectors.selectRepliesForParentId(populated, 'a'))), ['c']);
assert.deepEqual(plain(ids(selectors.selectTopLevelCommentsForUri(populated, 'video', 1))), ['a']);
assert.deepEqual(plain(ids(selectors.selectTopLevelCommentsForUri(populated, 'video', 2))), ['a', 'b']);
assert.equal(selectors.makeSelectTotalCommentsCountForUri('video')(populated), 12);
assert.equal(selectors.makeSelectTopLevelTotalCommentsForUri('video')(populated), 9);
assert.equal(selectors.makeSelectTopLevelTotalPagesForUri('video')(populated), 3);
assert.deepEqual(plain(selectors.makeSelectCommentIdsForUri('video')(populated)), ['a', 'b', 'missing']);
const reactions = {
  ...populated,
  comments: {
    ...populated.comments,
    myReactsByCommentId: { 'a:mine': ['like'] },
    othersReactsByCommentId: { a: { like: 2 } },
  },
};
assert.deepEqual(plain(selectors.selectMyReactsForComment(reactions, 'a:mine')), ['like']);
assert.deepEqual(plain(selectors.selectOthersReactsForComment(reactions, 'a')), { like: 2 });
const filtered = state();
const authors = ['normal', 'muted', 'blocked', 'blacklisted', 'filtered', 'mature', 'unresolved', 'mine'];
for (const author of authors) {
  filtered.comments.commentById[author] = comment(author);
  if (author !== 'unresolved') filtered.claims.byId[author] = channel(author, author === 'mature' ? ['mature'] : []);
}
filtered.comments.byId.content = authors;
filtered.comments.topLevelCommentsById.content = authors;
filtered.comments.moderationBlockList = Object.freeze([comment('blocked').channel_url]);
filtered.muted = [comment('muted').channel_url, comment('mine').channel_url];
filtered.blacklisted = { 'blacklisted:0': true, 'mine:0': true };
filtered.filtered = { 'filtered:0': true };
filtered.claims.myChannelClaims = ['mine'];
assert.deepEqual(plain(ids(selectors.selectCommentsForUri(filtered, 'video'))), ['normal', 'unresolved', 'mine']);
assert.deepEqual(plain(ids(selectors.selectCommentsForUri({ ...filtered, mature: true }, 'video'))), [
  'normal',
  'mature',
  'unresolved',
  'mine',
]);
const owned = { ...filtered, claims: { ...filtered.claims, myClaims: ['content'], myChannelClaims: ['mine'] } };
assert(
  ids(selectors.selectCommentsForUri(owned, 'video')).includes('blocked'),
  'Own content must use the raw claim-ID array for the personal-block exception'
);
assert(
  !ids(selectors.selectCommentsForUri(owned, 'video')).includes('muted'),
  'The own-content exception must not bypass muting'
);
assert(!ids(selectors.selectCommentsForUri(owned, 'video')).includes('blacklisted'));
const rawOwnedChannel = { ...filtered, claims: { ...filtered.claims, myClaims: ['mine'], myChannelClaims: [] } };
assert(ids(selectors.selectCommentsForUri(rawOwnedChannel, 'video')).includes('mine'));
const mentionState = {
  ...populated,
  claims: {
    ...populated.claims,
    byId: {
      a: channel('a'),
      b: channel('b'),
      content: {
        claim_id: 'content',
        value_type: 'stream',
        is_channel_signature_valid: true,
        signing_channel: channel('creator'),
      },
    },
    claimsByUri: { video: 'content', [comment('a').channel_url]: 'a', [comment('b').channel_url]: 'b' },
  },
  subscriptions: [comment('b').channel_url],
  search: [comment('a').channel_url, 'not-resolved'],
  query: '@a',
};
const mentions = selectors.selectChannelMentionData(mentionState, 'video', 1);
assert.deepEqual(plain(mentions.canonicalCommentors), [channel('a').canonical_url]);
assert.equal(mentions.canonicalCreatorUri, channel('creator').canonical_url);
assert.deepEqual(plain(mentions.canonicalSubscriptions), [channel('b').canonical_url]);
assert.deepEqual(plain(mentions.canonicalSearch), [channel('a').canonical_url]);
assert.equal(mentions.hasNewResolvedResults, true);
assert.equal(mentions.query, '@a');
assert.deepEqual(plain(selectors.selectChannelMentionData(empty, 'unresolved').canonicalSubscriptions), []);
const noAuthor = state();
noAuthor.comments.commentById.a = { ...comment('a'), channel_url: undefined };
noAuthor.comments.topLevelCommentsById.content = ['a'];
assert.deepEqual(plain(selectors.selectChannelMentionData(noAuthor, 'video').commentorUris), []);
console.log(
  'PASS comment selectors: immutable moderation, missing records, cached pages, reactions, ownership, visibility and mentions'
);

const stickers = load('constants/stickers.js', {});
const number = load(
  'util/number.js',
  { './intlNumberFormat': load('util/intlNumberFormat.js', {}) },
  { localStorage: { getItem: () => 'en' } }
);
const helpers = load('util/comments.js', {
  'constants/comment': constants,
  'constants/stickers': stickers,
  'constants/reactions': load('constants/reactions.js', {}),
  'util/number': number,
});
for (const sticker of [...stickers.FREE_GLOBAL_STICKERS, ...stickers.PAID_GLOBAL_STICKERS]) {
  const text = helpers.buildValidSticker(sticker.name);
  assert.strictEqual(helpers.parseSticker(text), sticker);
  assert.equal(helpers.getStickerUrl(text), sticker.url);
  assert.equal(helpers.parseSticker('text ' + text), false);
}
assert.equal(helpers.parseSticker('ordinary comment'), null);
assert.equal(helpers.parseSticker('<stkr>:UNKNOWN_STICKER:<stkr>'), undefined);
assert.equal(helpers.getStickerUrl('ordinary comment'), null);
assert.equal(helpers.getCommentsListTitle(0), 'Leave a comment');
assert.equal(helpers.getCommentsListTitle(1), '1 comment');
assert.equal(helpers.getCommentsListTitle(1234), '1.23K comments');
const list = Object.freeze([comment('a'), comment('b'), { ...comment('pin'), is_pinned: true }]);
assert.deepEqual(
  plain(
    ids(
      helpers.sortComments({
        comments: list,
        reactionsById: {},
        sort: constants.SORT_COMMENTS_NEW,
        isMyComment: () => false,
      })
    )
  ),
  ['pin', 'a', 'b']
);
for (const sort of [constants.SORT_COMMENTS_BEST, constants.SORT_COMMENTS_CONTROVERSIAL]) {
  const sorted = helpers.sortComments({
    comments: [comment('a'), comment('b')],
    reactionsById: { a: { like: 1 }, b: { like: 20, dislike: 2 } },
    sort,
    isMyComment: () => false,
  });
  assert.deepEqual(plain(ids(sorted)), ['b', 'a']);
}
assert.deepEqual(plain(ids(list)), ['a', 'b', 'pin']);
assert.deepEqual(
  plain(
    helpers.sortComments({
      comments: null,
      reactionsById: {},
      sort: constants.SORT_COMMENTS_NEW,
      isMyComment: () => false,
    })
  ),
  []
);
console.log('PASS comment display helpers: sticker catalog, non-sticker results, counts, sorting and unchanged input');
