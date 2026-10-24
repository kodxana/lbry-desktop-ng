/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const parent = path.join(root, 'dist/flow-tests');
fs.mkdirSync(parent, { recursive: true });
const cwd = fs.mkdtempSync(path.join(parent, 'api-'));
const write = (file, source) => {
  fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  fs.writeFileSync(path.join(cwd, file), source);
};
for (const file of ['.flowconfig', 'ui/lbry.js', 'ui/comments.js', 'desktop-settings.json']) {
  write(file, fs.readFileSync(path.join(root, file), 'utf8'));
}
for (const file of fs.readdirSync(path.join(root, 'flow-typed')).filter((file) => file.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(root, 'flow-typed', file), 'utf8');
  if (!/declare module\s/.test(source)) write('flow-typed/' + file, source);
}
write('configValues.js', '// @flow\nexport const COMMENT_SERVER_API: string = "https://comments.invalid/api";');
const fixture = `// @flow
import Lbry from 'lbry';
import Comments from 'comments';
export const status: Promise<StatusResponse> = Lbry.connect();
export const preferences: Promise<unknown> = Lbry.preference_set({key: 'shared', value: '{}'});
export const signed: Promise<ChannelSignResponse> = Lbry.channel_sign({channel_id: 'id', hexdata: 'abcd'});
export const publication: Promise<PublishResponse> = Lbry.publish({name: 'test', bid: '0.01'});
export const comments: Promise<CommentListResponse> = Comments.comment_list({page: 1, page_size: 20});
export const unblocked: Promise<unknown> = Comments.moderation_unblock({
  mod_channel_id: 'mod', mod_channel_name: '@mod', signature: 'sig', signing_ts: '1',
  un_blocked_channel_id: 'target', un_blocked_channel_name: '@target',
});
export function resolveResult(response: ResolveResponse): ?string {
  const claim = response['lbry://test'];
  return claim.value_type === undefined ? null : claim.claim_id;
}
export function syncResult(action: ThunkAction<Promise<boolean>>, dispatch: Dispatch, getState: GetState): Promise<boolean> {
  return action(dispatch, getState);
}
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
assert.deepEqual(check().errors, [], 'Actual SDK/comment clients and valid callers must type-check');
const invalid = {
  unknownMethod: 'export const invalid = Lbry.wallet_typo();',
  status: 'export const invalid: Promise<string> = Lbry.connect();',
  preferenceKey: 'export const invalid = Lbry.preference_set({value: "{}"});',
  preferenceValue: 'export const invalid = Lbry.preference_set({key: "shared", value: {}});',
  signature: 'export const invalid: Promise<string> = Lbry.channel_sign({channel_id: "id", hexdata: "abcd"});',
  commentPage: 'export const invalid = Comments.comment_list({page: "1", page_size: 20});',
  commentResult: 'export const invalid: Promise<string> = Comments.comment_list({page: 1, page_size: 20});',
  unblockTarget:
    'export const invalid = Comments.moderation_unblock({mod_channel_id: "id", mod_channel_name: "@name", signature: "sig", signing_ts: "1", blocked_channel_id: "target", blocked_channel_name: "@target"});',
  resolverError: 'export function invalid(response: ResolveResponse): string { return response.uri.claim_id; }',
  asyncThunk:
    'export function invalid(action: ThunkAction<Promise<boolean>>, dispatch: Dispatch, getState: GetState): boolean { return action(dispatch, getState); }',
};
for (const [name, source] of Object.entries(invalid)) {
  write('invalid-' + name + '.js', fixture + '\n' + source.replace('const invalid =', 'const invalid: unknown ='));
}
const failed = check();
assert.equal(failed.passed, false);
for (const name of Object.keys(invalid)) {
  assert(
    failed.errors.some(
      (error) =>
        !error.error_codes.includes('signature-verification-failure') &&
        error.message.some((message) => message.loc?.source.endsWith('invalid-' + name + '.js'))
    ),
    'Incorrect ' + name + ' contract must be rejected'
  );
}
console.log('PASS SDK/comment client source and ' + Object.keys(invalid).length + ' invalid API contracts');
