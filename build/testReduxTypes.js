/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const parent = path.join(root, 'dist/flow-tests');
fs.mkdirSync(parent, { recursive: true });
const cwd = fs.mkdtempSync(path.join(parent, 'redux-'));
const write = (file, source) => {
  fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  fs.writeFileSync(path.join(cwd, file), source);
};
for (const file of [
  '.flowconfig',
  'desktop-settings.json',
  'ui/lbry.js',
  'ui/redux/actions/collections.js',
  'ui/redux/actions/notifications.js',
  'ui/redux/reducers/claims.js',
  'ui/redux/reducers/comments.js',
  'ui/redux/reducers/notifications.js',
  'ui/constants/action_types.js',
  'ui/constants/collections.js',
  'ui/constants/comment.js',
  'ui/constants/notifications.js',
  'ui/util/redux-utils.js',
  'ui/util/merge-claim.js',
])
  write(file, fs.readFileSync(path.join(root, file), 'utf8'));
for (const file of fs.readdirSync(path.join(root, 'flow-typed')).filter((file) => file.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(root, 'flow-typed', file), 'utf8');
  if (!/declare module\s/.test(source)) write('flow-typed/' + file, source);
}
// Keep unrelated selectors and network clients at their public input/output boundaries.
write(
  'flow-typed/inputs.js',
  `
declare module 'uuid' { declare export function v4(): string; }
declare module 'util/lbryURI' { declare export function isURIEqual(a: string, b: string): boolean; }
declare module 'redux/selectors/claims' {
  declare export function makeSelectClaimForClaimId(id: string): ({claims: ClaimsState, ...}) => Claim | void;
}
declare module 'redux/selectors/collections' {
  declare export function makeSelectCollectionForId(id: string): ({...}) => Collection | void;
  declare export function makeSelectPublishedCollectionForId(id: string): ({...}) => Collection | void;
  declare export function makeSelectUnpublishedCollectionForId(id: string): ({...}) => Collection | void;
  declare export function makeSelectEditedCollectionForId(id: string): ({...}) => Collection | void;
}
declare module 'redux/actions/claims' {
  declare export function doClaimSearch(options: {claim_ids: Array<string>, page: number, page_size: number}): ThunkAction<Promise<{[string]: {stream: Claim}} | false>>;
  declare export function doAbandonClaim(claim: Claim, callback?: () => void): ThunkAction<void>;
  declare export function doResolveUris(uris: Array<string>): ThunkAction<Promise<ResolveResponse> | void>;
}
declare module 'redux/selectors/notifications' {
  declare export function selectNotifications(state: {...}): Array<WebNotification>;
  declare export function selectNotificationsFiltered(state: {...}): Array<WebNotification>;
  declare export function selectNotificationCategories(state: {...}): Array<NotificationCategory> | void;
}
declare module 'lbryinc' {
  declare export var Lbryio: {
    call: ((resource: 'notification', method: 'categories') => Promise<Array<NotificationCategory>>) &
      ((resource: 'notification', method: 'list', params: {is_app_readable: boolean, type?: string}) => Promise<Array<WebNotification>>) &
      ((resource: 'notification', method: 'edit' | 'delete', params: {...}) => Promise<unknown>),
  };
}
`
);
const fixture = `// @flow
import {doFetchItemsInCollections, doCollectionEdit, doLocalCollectionCreate} from 'redux/actions/collections';
import {doNotificationList, doSeeNotifications, doError, doToast} from 'redux/actions/notifications';
import comments from 'redux/reducers/comments';
import notifications from 'redux/reducers/notifications';
import {claimsReducer} from 'redux/reducers/claims';
export const items: ThunkAction<Promise<void>> = doFetchItemsInCollections({collectionIds: ['id'], pageSize: 5});
export const list: ThunkAction<Promise<void>> = doNotificationList(['comment']);
export const seen: ThunkAction<Promise<void>> = doSeeNotifications([7]);
export const toast: DoToast = doToast({message: 'test'});
export const error: DoError = doError('test');
export const commentState: CommentsState = comments(undefined, {type: 'init'});
export const notificationState: NotificationState = notifications(undefined, {type: 'init'});
export const claimState: ClaimsState = claimsReducer(undefined, {type: 'init'});
export const local: ThunkAction<{type: string, data: {entry: Collection}}> = doLocalCollectionCreate('test', [], 'playlist');
export const edit: ThunkAction<Promise<boolean | {type: string, data: {message: string}}>> = doCollectionEdit('id', {uris: ['lbry://test']});
`;
write('valid.js', fixture);
const check = () => {
  const result = spawnSync(require('flow-bin'), ['full-check', '--max-workers', '2', '--json', '--strip-root'], {
    cwd,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert([0, 2].includes(result.status), result.stdout + result.stderr);
  return JSON.parse(result.stdout);
};
assert.deepEqual(check().errors, [], 'Collection/notification actions and three reducers must type-check');
const invalid = {
  pageSize: 'export const invalid = doFetchItemsInCollections({collectionIds: ["id"], pageSize: "5"});',
  result: 'export const invalid: ThunkAction<boolean> = doFetchItemsInCollections({collectionIds: []});',
  notificationId: 'export const invalid = doSeeNotifications(["7"]);',
  toast: 'export const invalid = doToast({message: 7});',
  error: 'export const invalid: DoError = {type: "CREATE_ERROR", data: {title: "test", text: "test"}};',
  commentParent: 'export function invalid(comment: LbryComment): void {comment.parent_id = 7;}',
  searchPage:
    'export function invalid(state: ClaimsState): void {state.claimSearchByQueryLastPageReached.query = [true];}',
  searchUrls: 'export function invalid(state: ClaimsState): void {state.claimSearchByQuery.query = [7];}',
};
for (const [name, source] of Object.entries(invalid))
  write('invalid-' + name + '.js', fixture + '\n' + source.replace('const invalid =', 'const invalid: unknown ='));
const failed = check();
assert.equal(failed.passed, false);
for (const name of Object.keys(invalid))
  assert(
    failed.errors.some(
      (error) =>
        !error.error_codes.includes('signature-verification-failure') &&
        error.message.some((message) => message.loc?.source.endsWith('invalid-' + name + '.js'))
    ),
    'Incorrect ' + name + ' contract must be rejected'
  );
console.log(
  'PASS collection/notification action source, claim/comment/notification reducers and ' +
    Object.keys(invalid).length +
    ' invalid contracts'
);
