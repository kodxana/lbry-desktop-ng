/* eslint no-console:0 */
const assert = require('assert').strict;
const { load } = require('./testStartup');
const reselect = require('reselect');
const plain = (value) => JSON.parse(JSON.stringify(value));
const actions = load('constants/action_types.js', {});
const constants = load('constants/collections.js', {});
const uri = load('util/lbryURI.js', {}, { URLSearchParams });
const tags = load('constants/tags.js', {});
const claimHelpers = load('util/claim.js', { 'constants/tags': tags, 'util/lbryURI': uri });
const claims = load('redux/selectors/claims.js', {
  reselect,
  're-reselect': require('re-reselect'),
  'util/lbryURI': uri,
  'util/claim': claimHelpers,
  'constants/claim': load('constants/claim.js', { 'constants/tags': tags }),
  'redux/selectors/wallet': { selectSupportsByOutpoint: () => ({}) },
  lbryinc: { selectBlackListedOutpoints: () => [] },
});
const playback = load('util/collection-playback.js', {});
const selectors = load('redux/selectors/collections.js', {
  reselect,
  'redux/selectors/claims': claims,
  'util/lbryURI': uri,
  'util/claim': claimHelpers,
  'util/collection-playback': playback,
});
const reducer = load('redux/reducers/collections.js', {
  'constants/action_types': actions,
  'constants/collections': constants,
  'util/redux-utils': load('util/redux-utils.js', {}),
}).collectionsReducer;
const contentReducer = load('redux/reducers/content.js', { 'constants/action_types': actions }).default;
function state() {
  return {
    collections: plain(reducer(undefined, { type: '@@init' })),
    content: contentReducer(undefined, { type: '@@init' }),
    claims: { byId: {}, pendingById: {}, claimsByUri: {}, myCollectionClaims: [] },
  };
}
const collection = (id, items = [], extra = {}) => ({ id, items, name: id, updatedAt: 1, type: 'playlist', ...extra });
const link = (id) => 'lbry://item-' + id + '#' + id.repeat(40);
function fixture(items = ['a', 'b', 'c'].map(link)) {
  const result = state();
  result.collections.unpublished.list = collection('list', items);
  for (const id of ['a', 'b', 'c', 'd']) {
    result.claims.byId[id] = {
      claim_id: id,
      permanent_url: link(id),
      value_type: 'stream',
      value: { stream_type: id === 'b' ? 'image' : 'video' },
    };
    result.claims.claimsByUri[uri.normalizeURI(link(id))] = id;
  }
  return result;
}
const empty = state();
assert.equal(selectors.selectLastUsedCollection(empty), undefined);
assert.equal(selectors.makeSelectCollectionForId(undefined)(empty), undefined);
assert.equal(selectors.makeSelectCountForCollectionId('missing')(empty), null);
assert.equal(selectors.makeSelectNameForCollectionId('missing')(empty), '');
assert.deepEqual(plain(selectors.makeSelectClaimIdsForCollectionId('missing')(empty)), []);
assert.equal(selectors.makeSelectIndexForUrlInCollection(link('a'), 'missing')(empty), -1);
for (const name of [
  'makeSelectPreviousUrlForCollectionAndUrl',
  'makeSelectNextUrlForCollectionAndUrl',
  'makeSelectPrevPlayableUrlFromCollectionAndUrl',
  'makeSelectNextPlayableUrlFromCollectionAndUrl',
]) {
  assert.equal(selectors[name]('missing', link('a'))(empty), null);
}
const groups = state();
groups.claims.myCollectionClaims = ['owned', 'overlap'];
groups.collections.resolved = {
  owned: collection('owned'),
  other: collection('other'),
  overlap: collection('resolved'),
};
groups.collections.pending = { pending: collection('pending'), overlap: collection('pending-overlap') };
groups.collections.edited = {
  edited: collection('edited', ['kept'], { type: 'collection' }),
  overlap: collection('edited-overlap'),
};
groups.collections.unpublished.private = collection('private', ['private-url']);
const before = JSON.stringify(groups);
const published = selectors.selectMyPublishedCollections(groups);
assert.deepEqual(Object.keys(published).sort(), ['edited', 'overlap', 'owned', 'pending']);
assert.equal(published.overlap.id, 'edited-overlap');
assert.deepEqual(Object.keys(selectors.selectMyPublishedMixedCollections(groups)), ['edited']);
assert.deepEqual(Object.keys(selectors.selectMyPublishedPlaylistCollections(groups)).sort(), [
  'overlap',
  'owned',
  'pending',
]);
assert.equal(selectors.makeSelectCollectionIsMine('owned')(groups), true);
assert.equal(selectors.makeSelectCollectionIsMine('private')(groups), true);
assert.equal(selectors.makeSelectCollectionIsMine('watchlater')(groups), true);
assert.equal(selectors.makeSelectCollectionIsMine('other')(groups), false);
assert.equal(selectors.makeSelectClaimUrlInCollection('private-url')(groups), true);
assert.equal(selectors.makeSelectClaimUrlInCollection('kept')(groups), true);
assert.equal(selectors.makeSelectClaimUrlInCollection('absent')(groups), false);
assert.equal(JSON.stringify(groups), before);
assert.strictEqual(selectors.selectMyPublishedCollections(groups), published);
for (const [field, expected] of [
  ['builtin', 'builtin'],
  ['unpublished', 'unpublished'],
  ['edited', 'edited'],
  ['pending', 'pending'],
  ['resolved', 'resolved'],
]) {
  groups.collections[field].same = collection(expected);
}
let precedence = groups;
for (const key of ['builtin', 'unpublished', 'edited', 'pending', 'resolved']) {
  assert.equal(selectors.makeSelectCollectionForId('same')(precedence).id, key);
  precedence = { ...precedence, collections: { ...precedence.collections, [key]: {} } };
}
const records = fixture([null, link('a'), undefined, 'invalid uri', 'lbry://unresolved', link('c')]);
assert.deepEqual(plain(selectors.makeSelectClaimIdsForCollectionId('list')(records)), ['a'.repeat(40), 'c'.repeat(40)]);
assert.equal(
  records.collections.unpublished.list.items.length,
  6,
  'Reading valid IDs must preserve stored order and holes'
);
assert.equal(selectors.makeSelectCountForCollectionId('list')(records), 4);
const counted = {
  ...records,
  collections: {
    ...records.collections,
    unpublished: { list: { ...records.collections.unpublished.list, itemCount: 20 } },
  },
};
assert.equal(selectors.makeSelectCountForCollectionId('list')(counted), 20);
const list = fixture();
assert.equal(
  selectors.makeSelectIndexForUrlInCollection(link('d'), 'list')(list),
  -1,
  'A resolved claim outside the list is not an index'
);
assert.equal(selectors.makeSelectNextUrlForCollectionAndUrl('list', 'lbry://unresolved')(list), null);
const alias = 'lbry://alias#a';
const withAlias = {
  ...list,
  claims: { ...list.claims, claimsByUri: { ...list.claims.claimsByUri, [uri.normalizeURI(alias)]: 'a' } },
};
assert.equal(selectors.makeSelectIndexForUrlInCollection(alias, 'list')(withAlias), 0);
assert.equal(selectors.makeSelectPreviousUrlForCollectionAndUrl('list', link('a'))(list), null);
assert.equal(selectors.makeSelectNextUrlForCollectionAndUrl('list', link('c'))(list), null);
assert.equal(selectors.makeSelectNextUrlForCollectionAndUrl('list', link('a'))(list), link('b'));
assert.equal(selectors.makeSelectNextPlayableUrlFromCollectionAndUrl('list', link('a'))(list), link('c'));
assert.equal(selectors.makeSelectPrevPlayableUrlFromCollectionAndUrl('list', link('c'))(list), link('a'));
const looped = {
  ...list,
  content: contentReducer(list.content, { type: actions.TOGGLE_LOOP_LIST, data: { collectionId: 'list', loop: true } }),
};
assert.equal(selectors.makeSelectNextPlayableUrlFromCollectionAndUrl('list', link('c'))(looped), link('a'));
assert.equal(selectors.makeSelectPreviousUrlForCollectionAndUrl('list', link('a'))(looped), link('c'));
const unrelatedLoop = { ...looped, content: { loopList: { collectionId: 'other', loop: true } } };
assert.equal(selectors.makeSelectNextPlayableUrlFromCollectionAndUrl('list', link('c'))(unrelatedLoop), null);
const shuffled = {
  ...looped,
  content: contentReducer(looped.content, {
    type: actions.TOGGLE_SHUFFLE_LIST,
    data: { collectionId: 'list', newUrls: [link('c'), link('b'), link('a')] },
  }),
};
assert.equal(selectors.makeSelectIndexForUrlInCollection(link('a'), 'list')(shuffled), 2);
assert.equal(selectors.makeSelectIndexForUrlInCollection(link('a'), 'list', true)(shuffled), 0);
assert.equal(selectors.makeSelectNextPlayableUrlFromCollectionAndUrl('list', link('c'))(shuffled), link('a'));
for (const urls of [[link('b')], [link('b'), link('b')], [link('b'), 'lbry://missing', null]]) {
  const unavailable = fixture(urls);
  unavailable.content = looped.content;
  assert.equal(selectors.makeSelectNextPlayableUrlFromCollectionAndUrl('list', link('b'))(unavailable), null);
  assert.equal(selectors.makeSelectPrevPlayableUrlFromCollectionAndUrl('list', link('b'))(unavailable), null);
}
const holes = fixture([link('a'), null, 'lbry://missing', link('b'), link('b'), link('c')]);
assert.equal(selectors.makeSelectNextPlayableUrlFromCollectionAndUrl('list', link('a'))(holes), link('c'));
assert.equal(selectors.makeSelectPrevPlayableUrlFromCollectionAndUrl('list', link('c'))(holes), link('a'));
const single = fixture([link('a')]);
single.content = looped.content;
assert.equal(selectors.makeSelectNextPlayableUrlFromCollectionAndUrl('list', link('a'))(single), link('a'));
let inspected = 0;
assert.equal(
  playback.findPlayableUrl(Object.freeze(['one', 'two', 'three']), 0, 1, true, () => {
    inspected++;
    return false;
  }),
  null
);
assert.equal(inspected, 3, 'Repeat must inspect at most one pass through the list');
console.log(
  'PASS collection selectors: ownership, precedence, immutable lists, missing IDs/counts, aliases, shuffle, repeat and bounded playable navigation'
);

const noRpc = new Proxy(
  {},
  {
    get: () => () => {
      throw Error('Collection editing must not make an SDK call');
    },
  }
);
const collectionActions = load('redux/actions/collections.js', {
  'constants/action_types': actions,
  'constants/collections': constants,
  uuid: { v4: () => 'new-id' },
  lbry: noRpc,
  'redux/actions/claims': noRpc,
  'redux/selectors/claims': claims,
  'redux/selectors/collections': selectors,
});
const contentActions = load('redux/actions/content.js', {
  'constants/action_types': actions,
  'constants/modal_types': {},
  'constants/settings': {},
  'util/desktop': noRpc,
  'util/download-notifications': noRpc,
  'redux/actions/app': noRpc,
  'redux/selectors/claims': claims,
  'redux/selectors/file_info': noRpc,
  'redux/selectors/collections': selectors,
  'redux/actions/notifications': { doToast: (data) => ({ type: 'toast', data }) },
  'redux/actions/file': noRpc,
  lbry: noRpc,
  lbryinc: noRpc,
  'redux/selectors/settings': noRpc,
});
async function edits() {
  let current = fixture();
  const dispatched = [];
  const dispatch = (action) => {
    dispatched.push(action);
    current = {
      ...current,
      collections: reducer(current.collections, action),
      content: contentReducer(current.content, action),
    };
    return action;
  };
  const getState = () => current;
  await collectionActions.doCollectionEdit('missing', { name: 'test' })(dispatch, getState);
  assert.equal(dispatched.pop().type, actions.COLLECTION_ERROR);
  current.collections.edited.draft = collection('draft', [link('a'), link('b')]);
  await collectionActions.doCollectionEdit('draft', { order: { from: 1, to: 0 } })(dispatch, getState);
  assert.deepEqual(
    plain(current.collections.edited.draft.items),
    [link('b'), link('a')],
    'Persisted edits can change before the published collection resolves'
  );
  current.collections.resolved.draft = collection('draft', [link('a'), link('b')]);
  await collectionActions.doCollectionEdit('draft', { order: { from: 1, to: 0 } })(dispatch, getState);
  assert.equal(current.collections.edited.draft, undefined, 'Returning to the published order removes the local edit');
  const count = dispatched.length;
  contentActions.doToggleShuffleList(link('a'), 'missing', true, false)(dispatch, getState);
  assert.equal(dispatched.length, count, 'Shuffling a deleted collection must be a no-op');
  const original = current.collections.unpublished.list.items.slice();
  contentActions.doToggleShuffleList(link('d'), 'list', true, true)(dispatch, getState);
  assert.deepEqual(
    plain(current.content.shuffleList.newUrls).sort(),
    original.slice().sort(),
    'A stale playing URI must not replace a collection entry'
  );
  contentActions.doToggleShuffleList(link('b'), 'list', true, true)(dispatch, getState);
  assert.equal(current.content.shuffleList.newUrls[0], link('b'));
  assert.deepEqual(plain(current.content.shuffleList.newUrls).sort(), original.slice().sort());
  assert.deepEqual(plain(current.collections.unpublished.list.items), original);
  contentActions.doToggleShuffleList(link('b'), 'list', false, true)(dispatch, getState);
  assert.equal(current.content.shuffleList.newUrls, false);
  console.log(
    'PASS collection actions: missing collections, persisted edits before resolve, reset to published order and shuffle membership without SDK writes'
  );
}
edits().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
