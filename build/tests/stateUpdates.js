import { strict as assert } from 'assert';
import * as ACTIONS from 'constants/action_types';
import * as TRANSACTIONS from 'constants/transaction_types';
import { handleActions } from 'util/redux-utils';
import { handleActions as accountHandleActions } from '../../extras/lbryinc/util/redux-utils-delete-me';
import app from 'redux/reducers/app';
import sync from 'redux/reducers/sync';
import settings from 'redux/reducers/settings';
import user from 'redux/reducers/user';
import content from 'redux/reducers/content';
import search from 'redux/reducers/search';
import comments from 'redux/reducers/comments';
import rewards from 'redux/reducers/rewards';
import { walletReducer as wallet } from 'redux/reducers/wallet';
import { claimsReducer as claims } from 'redux/reducers/claims';
import { collectionsReducer as collections } from 'redux/reducers/collections';
import { fileInfoReducer as files } from 'redux/reducers/file_info';
import { selectTransactionItems } from 'redux/selectors/wallet';
import { authReducer as auth } from '../../extras/lbryinc/redux/reducers/auth';
import { syncReducer as accountSync } from '../../extras/lbryinc/redux/reducers/sync';
import { costInfoReducer as costs } from '../../extras/lbryinc/redux/reducers/cost_info';
import { statsReducer as stats } from '../../extras/lbryinc/redux/reducers/stats';

const init = (reducer) => reducer(undefined, { type: 'fixture/unknown' });
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};
const update = (reducer, state, type, data) => {
  assert.equal(typeof type, 'string', 'Use a real action constant');
  freeze(state);
  freeze(data);
  const next = reducer(state, { type, data });
  assert.notEqual(next, state, 'Handled state updates must create a fresh object');
  return next;
};

function helpers() {
  for (const create of [handleActions, accountHandleActions]) {
    const nested = { retained: true };
    const symbol = Symbol('fixture');
    const initial = freeze({ balance: '0.125', nested, enabled: true, pending: true, [symbol]: 'retained' });
    const reducer = create(
      {
        change: (state, action) => action.data,
        nothing: () => undefined,
        empty: () => null,
      },
      initial
    );
    assert.equal(init(reducer), initial, 'Unknown actions must preserve identity for redux-persist');
    const next = reducer(initial, { type: 'change', data: { balance: '0', enabled: false, pending: undefined } });
    assert.deepEqual(next, { balance: '0', nested, enabled: false, pending: undefined, [symbol]: 'retained' });
    assert.equal(next.nested, nested, 'Merging is shallow, not a deep clone');
    assert(Object.hasOwn(next, 'pending'), 'Explicit undefined must overwrite an existing value');
    for (const type of ['nothing', 'empty']) {
      const unchanged = reducer(initial, { type });
      assert.deepEqual(unchanged, initial);
      assert.notEqual(unchanged, initial);
    }
    assert.equal(reducer(next, { type: 'fixture/unknown' }), next);
  }
}

function walletAndUpdates() {
  let state = init(wallet);
  state = update(wallet, state, ACTIONS.UPDATE_BALANCE, {
    syncStatus: null,
    balance: '0.125',
    totalBalance: '0.500',
    reservedBalance: '0.375',
    claimsBalance: '0.250',
    supportsBalance: '0.125',
    tipsBalance: '0',
  });
  assert.equal(state.balance, '0.125');
  assert.equal(state.totalBalance, '0.500');
  state = update(wallet, state, ACTIONS.SET_DRAFT_TRANSACTION_AMOUNT, { amount: '0.125' });
  state = update(wallet, state, ACTIONS.SET_DRAFT_TRANSACTION_ADDRESS, { address: 'fixture-address' });
  const draft = state.draftTransaction;
  state = update(wallet, state, ACTIONS.SEND_TRANSACTION_STARTED);
  state = update(wallet, state, ACTIONS.SEND_TRANSACTION_FAILED, { error: 'fixture failure' });
  assert.equal(state.draftTransaction.amount, 0.125);
  assert.equal(state.draftTransaction.address, 'fixture-address');
  assert.equal(state.draftTransaction.error, 'fixture failure');
  assert.equal(state.draftTransaction.sending, false);
  assert.equal(draft.error, undefined);
  state = update(wallet, state, ACTIONS.SEND_TRANSACTION_COMPLETED);
  assert.deepEqual(state.draftTransaction, { amount: undefined, address: undefined });
  assert.equal(state.balance, '0.125');
  state = update(wallet, state, ACTIONS.ABANDON_CLAIM_SUPPORT_COMPLETED, {
    claimId: 'claim',
    type: 'support',
    txid: 'fixture-tx',
    effective: '0.125',
  });
  assert.equal(state.pendingSupportTransactions.claim.effective, '0.125');

  let application = update(app, init(app), ACTIONS.PASSWORD_SAVED, true);
  application = update(app, application, ACTIONS.AUTO_UPDATE_DOWNLOADING);
  application = update(app, application, ACTIONS.AUTO_UPDATE_DOWNLOADED);
  assert.equal(application.autoUpdateDownloaded, true);
  assert.equal(application.autoUpdateDownloading, false);
  application = update(app, application, ACTIONS.UPGRADE_CANCELLED);
  assert.equal(application.downloadProgress, null);
  assert.equal(application.upgradeDownloadComplete, false);
  assert.equal(application.modal, null);
  assert.equal(application.isPasswordSaved, true, 'Update choices must not clear password status');
  application = update(app, application, ACTIONS.PASSWORD_SAVED, false);
  assert.equal(application.isPasswordSaved, false);
}

function preferencesAndSync() {
  const defaults = freeze(init(settings));
  const persisted = freeze({ settings: { extra: 'retained', clientSettings: { theme: 'light', hide_balance: true } } });
  const restored = settings(defaults, { type: ACTIONS.REHYDRATE, payload: persisted });
  assert.equal(restored.clientSettings.theme, 'light');
  assert.equal(restored.clientSettings.enable_prerelease_updates, defaults.clientSettings.enable_prerelease_updates);
  assert.equal(restored.extra, 'retained');
  assert.equal(defaults.clientSettings.theme, 'dark');
  let changed = update(settings, restored, ACTIONS.CLIENT_SETTING_CHANGED, { key: 'theme', value: 'dark' });
  assert.equal(restored.clientSettings.theme, 'light');
  changed = update(settings, changed, ACTIONS.SHARED_PREFERENCE_SET, { key: 'fixture', value: false });
  assert.equal(changed.sharedPreferences.fixture, false);
  const initialUser = { ...init(user), user: { id: 1, primary_email: 'old@example.invalid' } };
  let account = update(user, initialUser, ACTIONS.USER_EMAIL_NEW_SUCCESS, { email: 'new@example.invalid' });
  account = update(user, account, ACTIONS.USER_EMAIL_NEW_CLEAR_ENTRY);
  assert.equal(account.user.primary_email, undefined);
  assert.equal(account.user.id, 1);
  assert.equal(initialUser.user.primary_email, 'old@example.invalid');
  account = update(user, account, ACTIONS.USER_PASSWORD_SET_CLEAR);
  assert.equal(account.passwordResetSuccess, false);
  assert.equal(account.passwordResetError, null);

  for (const reducer of [sync, accountSync]) {
    let state = update(reducer, init(reducer), ACTIONS.GET_SYNC_STARTED);
    state = update(reducer, state, ACTIONS.GET_SYNC_COMPLETED, {
      syncHash: 'fixture-hash',
      syncData: 'fixture-data',
      hasSyncedWallet: true,
      hashChanged: false,
      fatalError: false,
    });
    state = update(reducer, state, ACTIONS.SYNC_APPLY_STARTED);
    state = update(reducer, state, ACTIONS.SYNC_APPLY_BAD_PASSWORD);
    assert.equal(state.syncApplyPasswordError, true);
    state = update(reducer, state, ACTIONS.SYNC_APPLY_FAILED, { error: 'fixture failure' });
    assert.equal(state.syncApplyErrorMessage, 'fixture failure');
    assert.equal(state.syncApplyIsPending, false);
    assert.equal(state.syncData, 'fixture-data', 'Failed apply must retain the sync payload for retry');
    state = update(reducer, state, ACTIONS.SYNC_APPLY_STARTED);
    state = update(reducer, state, ACTIONS.SYNC_APPLY_COMPLETED);
    assert.equal(state.syncApplyPasswordError, false);
    assert.equal(state.syncApplyErrorMessage, '');
    assert.equal(reducer(state, { type: ACTIONS.SYNC_RESET }), init(reducer));
  }
}

function listsAndMetadata() {
  const savedFile = { outpoint: 'tx:0', completed: true };
  let fileState = update(files, init(files), ACTIONS.DOWNLOADING_STARTED, { outpoint: 'tx:0', fileInfo: savedFile });
  fileState = update(files, fileState, ACTIONS.DOWNLOADING_COMPLETED, { outpoint: 'tx:0', fileInfo: savedFile });
  assert.equal(fileState.byOutpoint['tx:0'], savedFile);
  assert.equal(fileState.downloadingByOutpoint['tx:0'], undefined);
  const beforeDelete = fileState;
  fileState = update(files, fileState, ACTIONS.FILE_DELETE, { outpoint: 'tx:0' });
  assert.equal(fileState.byOutpoint['tx:0'], undefined);
  assert.equal(beforeDelete.byOutpoint['tx:0'], savedFile);
  let collection = update(collections, init(collections), ACTIONS.COLLECTION_NEW, {
    entry: { id: 'fixture', name: 'Saved list', items: ['lbry://one'], updatedAt: 123, type: 'playlist' },
  });
  assert.deepEqual(
    collection.unpublished.fixture.items,
    ['lbry://one'],
    'Explicit list items override template defaults'
  );
  collection = update(collections, collection, ACTIONS.COLLECTION_DELETE, {
    id: 'fixture',
    collectionKey: 'unpublished',
  });
  assert.equal(collection.lastUsedCollection, undefined);
  assert.equal(collection.unpublished.fixture, undefined);
  const oldComments = init(comments);
  const commentState = update(comments, oldComments, ACTIONS.COMMENT_LIST_STARTED, { parentId: 'parent' });
  assert.equal(commentState.isLoadingByParentId.parent, true);
  assert.equal(oldComments.isLoadingByParentId.parent, undefined);

  const comment = { comment_id: 'one', claim_id: 'claim', comment: 'fixture', is_pinned: false };
  const listed = update(comments, oldComments, ACTIONS.COMMENT_LIST_COMPLETED, {
    comments: [comment],
    parentId: null,
    totalItems: 1,
    totalFilteredItems: 1,
    totalPages: 1,
    claimId: 'claim',
    uri: 'lbry://one',
    disabled: false,
    creatorClaimId: 'channel',
  });
  assert.equal(listed.commentById.one, comment);
  assert.deepEqual(listed.topLevelCommentsById.claim, ['one']);
  assert.equal(listed.settingsByChannelId.channel.comments_enabled, true);
  assert.equal(oldComments.commentById.one, undefined);
  const beforeClaims = init(claims);
  let claimState = update(claims, beforeClaims, ACTIONS.CLAIM_SEARCH_STARTED, { query: 'fixture' });
  claimState = update(claims, claimState, ACTIONS.CLAIM_SEARCH_COMPLETED, {
    query: 'fixture',
    urls: ['lbry://one'],
    append: false,
    pageSize: 2,
    resolveInfo: {},
  });
  assert.deepEqual(claimState.claimSearchByQuery.fixture, ['lbry://one']);
  assert.equal(claimState.fetchingClaimSearchByQuery.fixture, undefined);
  assert.equal(claimState.claimSearchByQueryLastPageReached.fixture, true);
  assert.equal(beforeClaims.claimSearchByQuery.fixture, undefined);

  let playback = update(content, init(content), ACTIONS.SET_PRIMARY_URI, { uri: 'lbry://one' });
  playback = update(content, playback, ACTIONS.SET_PLAYING_URI, {
    uri: 'lbry://two',
    source: 'collection',
    pathname: '/fixture',
  });
  playback = update(content, playback, ACTIONS.TOGGLE_SHUFFLE_LIST, { collectionId: 'list', newUrls: ['lbry://two'] });
  assert.equal(playback.playingUri.primaryUri, 'lbry://one');
  assert.equal(playback.playingUri.uri, 'lbry://two');
  assert.deepEqual(playback.shuffleList.newUrls, ['lbry://two']);

  let result = update(search, init(search), ACTIONS.SEARCH_SUCCESS, {
    query: 'fixture&from=0',
    uris: ['lbry://one'],
    from: 0,
    size: 1,
    recsys: false,
  });
  const firstResults = result.resultsByQuery.fixture;
  result = update(search, result, ACTIONS.SEARCH_SUCCESS, {
    query: 'fixture&from=1',
    uris: ['lbry://one', 'lbry://two'],
    from: 1,
    size: 3,
    recsys: false,
  });
  assert.deepEqual(result.resultsByQuery.fixture.uris, ['lbry://one', 'lbry://two']);
  assert.deepEqual(firstResults.uris, ['lbry://one']);
  assert.equal(result.hasReachedMaxResultsLength.fixture, true);

  const reward = { claim_code: 'fixture', reward_type: 'test' };
  let rewardState = update(rewards, init(rewards), ACTIONS.CLAIM_REWARD_STARTED, { reward });
  rewardState = update(rewards, rewardState, ACTIONS.CLAIM_REWARD_FAILURE, { reward, error: { message: 'fixture' } });
  assert.equal(rewardState.claimPendingByType.test, undefined);
  assert.equal(rewardState.claimErrorsByType.test, 'fixture');
  let cost = update(costs, init(costs), ACTIONS.FETCH_COST_INFO_STARTED, { uri: 'lbry://one' });
  cost = update(costs, cost, ACTIONS.FETCH_COST_INFO_COMPLETED, { uri: 'lbry://one', costInfo: { cost: '0.125' } });
  assert.equal(cost.byUri['lbry://one'].cost, '0.125');
  assert.equal(cost.fetching['lbry://one'], undefined);
  const views = update(stats, init(stats), ACTIONS.FETCH_VIEW_COUNT_COMPLETED, {
    claimIdCsv: 'one,two',
    viewCounts: [1, 2],
  });
  assert.deepEqual(views.viewCountById, { one: 1, two: 2 });
  let token = update(auth, init(auth), ACTIONS.GENERATE_AUTH_TOKEN_SUCCESS, { authToken: 'fixture-token' });
  token = update(auth, token, ACTIONS.GENERATE_AUTH_TOKEN_FAILURE);
  assert.equal(token.authToken, null);
}

function transactions() {
  const base = {
    value: '-1.25',
    fee: '-0.01',
    timestamp: 100,
    confirmations: 2,
    claim_info: [],
    support_info: [],
    update_info: [],
    abandon_info: [],
  };
  const byId = freeze({
    publish: { ...base, claim_info: [{ claim_name: 'file', claim_id: 'claim', nout: 0, balance_delta: '-0.5' }] },
    tip: { ...base, support_info: [{ is_tip: true, claim_id: 'claim', nout: 1, balance_delta: '-0.25' }] },
    update: { ...base, update_info: [{ claim_id: 'claim', balance_delta: '-0.1' }] },
    abandon: { ...base, value: '0.5', abandon_info: [{ claim_id: 'claim', balance_delta: '0.5' }] },
    receive: { ...base, value: '2', timestamp: 101 },
    feeOnly: { ...base, value: '-0.01' },
  });
  const entries = selectTransactionItems({ wallet: { transactions: byId } });
  assert.equal(entries.length, 5, 'Fee-only transactions stay hidden');
  assert.equal(entries[0].txid, 'receive');
  assert.equal(entries[0].amount, 2);
  for (const [id, type, amount] of [
    ['publish', TRANSACTIONS.PUBLISH, -0.5],
    ['tip', TRANSACTIONS.TIP, -0.25],
    ['update', TRANSACTIONS.UPDATE, -0.1],
    ['abandon', TRANSACTIONS.ABANDON, 0.5],
  ]) {
    const entry = entries.find((value) => value.txid === id);
    assert.equal(entry.type, type);
    assert.equal(entry.amount, amount);
    assert.equal(entry.fee, -0.01);
    assert.equal(entry.claim_id, 'claim');
  }
}

export default function stateUpdates() {
  for (const reducer of [
    app,
    sync,
    settings,
    user,
    content,
    search,
    comments,
    rewards,
    wallet,
    claims,
    collections,
    files,
    auth,
    accountSync,
    costs,
    stats,
  ]) {
    const initial = init(reducer);
    assert.equal(reducer(initial, { type: 'fixture/unknown' }), initial);
  }
  helpers();
  walletAndUpdates();
  preferencesAndSync();
  listsAndMetadata();
  transactions();
  return 'state updates preserve reducer identity, wallet transaction values, update choices, saved settings, sync retries and copied maps';
}
