// @flow
import * as ACTIONS from 'constants/action_types';

export const balance: BalanceResponse = {
  available: '0.125',
  reserved: '0.000',
  total: '0.125',
  reserved_subtotals: { claims: '0.000', supports: '0.000', tips: '0.000' },
  future_sdk_field: true,
};
export const fee: Fee = { amount: '0.125', currency: 'LBC', address: 'fixture' };
export const disk: DiskSpace = { total: 100, free: 50, filesystem: 'fixture' };
export function downloaded(file: FileListItem): FileListItem {
  return { ...file, completed: true, stopped: true };
}
export function downloading(file: FileListItem): FileListItem {
  return { ...file, completed: false, stopped: false };
}
export const channel: ChannelMetadata = {
  public_key: 'fixture',
  public_key_id: 'fixture',
  title: 'Test channel',
  locations: [{ country: 'PL', latitude: 52, longitude: 21 }],
};
export const stream: StreamMetadata = {
  title: 'Test video',
  source: { sd_hash: 'fixture', media_type: 'video/mp4', future_sdk_field: true },
  stream_type: 'video',
  video: { duration: 1, height: 720, width: 1280 },
  fee,
};
export function pin(comment: LbryComment): CommentPinResponse {
  return { items: comment };
}
export const state: NotificationState = {
  notifications: [],
  notificationsFiltered: [],
  notificationCategories: undefined,
  fetchingNotifications: false,
  errors: [],
  toasts: [],
};
export function read(notification: WebNotification): WebNotification {
  return { ...notification, is_read: true, is_seen: true };
}

// Application types must not override the browser's globals.
export const domComment: Comment = document.createComment('test');
export const browserLocation: Location = window.location;
export function browserNotification(notification: Notification): void {
  notification.close();
}

export const purchased: PurchaseUriCompleted = {
  type: ACTIONS.PURCHASE_URI_COMPLETED,
  data: { uri: 'lbry://test', streamingUrl: 'http://localhost' },
};
export const failed: PurchaseUriFailed = {
  type: ACTIONS.PURCHASE_URI_FAILED,
  data: { uri: 'lbry://test', error: new Error('fixture') },
};
export const started: PurchaseUriStarted = { ...purchased, type: ACTIONS.PURCHASE_URI_STARTED };
export const cleared: DeletePurchasedUri = { type: ACTIONS.CLEAR_PURCHASED_URI_SUCCESS, data: { uri: 'lbry://test' } };
export const toast: DoToast = { type: ACTIONS.CREATE_TOAST, data: { id: '1', params: { message: 'test' } } };
export const notification: DoNotification = {
  type: ACTIONS.CREATE_NOTIFICATION,
  data: { id: '1', dateCreated: 1, isRead: false },
};
export const edited: DoEditNotification = {
  type: ACTIONS.EDIT_NOTIFICATION,
  data: { notification: notification.data },
};
export const deleted: DoDeleteNotification = { type: ACTIONS.DELETE_NOTIFICATION, data: { id: '1' } };
export const error: DoError = { type: ACTIONS.CREATE_ERROR, data: { title: 'Test', text: 'Fixture' } };
export const dismissed: DoDismissError = { type: ACTIONS.DISMISS_ERROR };
export const options: UpdateSearchOptions = { type: ACTIONS.UPDATE_SEARCH_OPTIONS, data: { video: true, size: 20 } };
export const search: SearchSuccess = {
  type: ACTIONS.SEARCH_SUCCESS,
  data: { query: 'test', from: undefined, size: undefined, uris: ['lbry://test'], recsys: 'fixture' },
};
export const mention: MentionSearchResults = {
  type: ACTIONS.SET_MENTION_SEARCH_RESULTS,
  data: { query: 'test', uris: ['lbry://test'] },
};
