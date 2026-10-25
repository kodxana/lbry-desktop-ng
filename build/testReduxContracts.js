/* eslint no-console:0 */
const assert = require('assert').strict;
const { load } = require('./testStartup');
const actions = load('constants/action_types.js', {});
const utils = load('util/redux-utils.js', {});
const { BLOCK_LEVEL } = load('constants/comment.js', {});
const uri = load('util/lbryURI.js', {}, { URLSearchParams });
const comments = load('redux/reducers/comments.js', {
  'constants/action_types': actions,
  'util/redux-utils': utils,
  'constants/comment': { BLOCK_LEVEL },
  'util/lbryURI': uri,
}).default;
const notifications = load('redux/reducers/notifications.js', {
  'constants/action_types': actions,
  'util/redux-utils': utils,
}).default;
const calls = [];
const events = [];
let notifyState = notifications(undefined, { type: '@@init' });
let api;
const notifyActions = load('redux/actions/notifications.js', {
  'constants/action_types': actions,
  'constants/notifications': load('constants/notifications.js', {}),
  lbryinc: {
    Lbryio: {
      call: async (...args) => {
        calls.push(args);
        return api(...args);
      },
    },
  },
  uuid: require('uuid'),
  'redux/selectors/notifications': {
    selectNotifications: () => notifyState.notifications,
    selectNotificationsFiltered: () => notifyState.notificationsFiltered,
    selectNotificationCategories: () => notifyState.notificationCategories,
  },
  'redux/actions/claims': { doResolveUris: (uris) => ({ type: 'resolve', uris }) },
});
const dispatch = (action) => {
  if (typeof action === 'function') return action(dispatch, () => ({ notifications: notifyState }));
  events.push(action);
  notifyState = notifications(notifyState, action);
  return action;
};
const plain = (value) => JSON.parse(JSON.stringify(value));

async function notificationFailures() {
  for (const failingMethod of ['categories', 'list']) {
    notifyState = notifications(undefined, { type: '@@init' });
    const error = Error('fixture ' + failingMethod + ' failure');
    api = async (_resource, method) => {
      if (method === failingMethod) throw error;
      return [];
    };
    await dispatch(notifyActions.doNotificationList());
    assert.equal(events.at(-1).type, actions.NOTIFICATION_LIST_FAILED);
    assert.equal(
      notifyState.fetchingNotifications,
      false,
      'A rejected notification request must clear the loading state'
    );
    assert.equal(events.at(-1).data.error, error);
  }
}

async function notificationIds() {
  const first = { id: 7, is_seen: false, is_read: false };
  const second = { id: 9, is_seen: false, is_read: false };
  notifyState = {
    ...notifications(undefined, { type: '@@init' }),
    notifications: [first],
    notificationsFiltered: [first, second],
  };
  api = async () => true;
  await dispatch(notifyActions.doReadNotifications([]));
  assert.equal(calls.at(-1)[2].notification_ids, '7,9');
  assert(notifyState.notificationsFiltered.every((item) => item.is_read));
  await dispatch(notifyActions.doSeeNotifications([9]));
  assert.equal(notifyState.notificationsFiltered[1].is_seen, true);
  assert.equal(notifyState.notifications[0].is_seen, false);
  assert.equal(first.is_read, false, 'Read state must not mutate the prior notification');
  assert.equal(second.is_seen, false);
  const failed = notifyState;
  api = async () => {
    throw Error('fixture edit failure');
  };
  await dispatch(notifyActions.doReadNotifications([7]));
  assert.equal(events.at(-1).type, actions.NOTIFICATION_READ_FAILED);
  assert.deepEqual(notifyState.notifications, failed.notifications);
  const toast = notifyActions.doToast({ message: 'fixture' });
  dispatch(toast);
  assert.equal(notifyState.toasts.at(-1).params.message, 'fixture');
  dispatch(notifyActions.doError('fixture error'));
  assert.equal(notifyState.errors.at(-1).error, 'fixture error');
}

function commentState() {
  const initial = comments(undefined, { type: '@@init' });
  const parent = { comment_id: 'parent', claim_id: 'claim', replies: 0 };
  let state = { ...initial, commentById: { parent }, byId: { claim: ['parent'] }, totalCommentsById: { claim: 1 } };
  const reply = { comment_id: 'reply', claim_id: 'claim', parent_id: 'parent' };
  state = comments(state, {
    type: actions.COMMENT_CREATE_COMPLETED,
    data: { comment: reply, claimId: 'claim', uri: 'lbry://claim' },
  });
  assert.deepEqual(plain(state.repliesByParentId.parent), ['reply']);
  assert.equal(state.commentById.parent.replies, 1);
  state = comments(state, { type: actions.COMMENT_ABANDON_COMPLETED, data: { comment_id: 'reply' } });
  assert.equal(state.commentById.parent.replies, 0);
  assert.deepEqual(plain(state.repliesByParentId.parent), []);
  state = comments(state, {
    type: actions.COMMENT_REACTION_LIST_COMPLETED,
    data: {
      myReactions: { parent: { like: 1, dislike: 0 } },
      othersReactions: { parent: { like: 2 } },
      channelId: 'owner',
      commentIds: ['parent'],
    },
  });
  assert.deepEqual(plain(state.myReactsByCommentId), { 'parent:owner': ['like'] });
  assert.deepEqual(plain(state.othersReactsByCommentId), { 'parent:owner': { like: 2 } });
  state = comments(state, {
    type: actions.COMMENT_REACTION_LIST_COMPLETED,
    data: { myReactions: {}, othersReactions: {}, channelId: 'owner', commentIds: ['parent'] },
  });
  assert.deepEqual(plain(state.myReactsByCommentId), { 'parent:owner': [] });
  const blockedUri = 'lbry://@blocked#' + 'b'.repeat(40);
  for (const blockLevel of [BLOCK_LEVEL.SELF, BLOCK_LEVEL.ADMIN]) {
    const before = {
      ...initial,
      unBlockingByUri: Object.freeze({ [blockedUri]: true }),
      moderationBlockList: [blockedUri],
      adminBlockList: [blockedUri],
    };
    const after = comments(before, {
      type: actions.COMMENT_MODERATION_UN_BLOCK_COMPLETE,
      data: { blockedUri, blockLevel },
    });
    assert.equal(before.unBlockingByUri[blockedUri], true, 'Unblocking must not mutate prior Redux state');
    assert.equal(after.unBlockingByUri[blockedUri], undefined);
  }
  const withoutChannel = { ...initial, commentById: { parent } };
  assert.doesNotThrow(() =>
    comments(withoutChannel, {
      type: actions.COMMENT_MODERATION_BLOCK_COMPLETE,
      data: { blockedUri, blockLevel: BLOCK_LEVEL.SELF },
    })
  );
}

async function main() {
  await notificationFailures();
  await notificationIds();
  commentState();
  console.log(
    'PASS notification failures and IDs, error/toast payloads, comment replies/reactions and immutable unblock state'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
