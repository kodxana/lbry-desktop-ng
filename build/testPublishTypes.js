/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const parent = path.join(root, 'dist/flow-tests');
fs.mkdirSync(parent, { recursive: true });
const cwd = fs.mkdtempSync(path.join(parent, 'publish-'));
const write = (file, source) => {
  fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  fs.writeFileSync(path.join(cwd, file), source);
};
for (const file of [
  '.flowconfig',
  'desktop-settings.json',
  'ui/lbry.js',
  'ui/redux/actions/publish.js',
  'ui/redux/reducers/publish.js',
  'ui/constants/action_types.js',
  'ui/constants/modal_types.js',
  'ui/constants/pages.js',
  'ui/constants/licenses.js',
  'ui/constants/speech_urls.js',
  'ui/constants/thumbnail_upload_statuses.js',
  'ui/constants/claim.js',
  'ui/constants/tags.js',
  'ui/util/redux-utils.js',
  'ui/util/batch-actions.js',
  'ui/util/format-credits.js',
  'ui/util/intlNumberFormat.js',
])
  write(file, fs.readFileSync(path.join(root, file), 'utf8'));
for (const file of fs.readdirSync(path.join(root, 'flow-typed')).filter((file) => file.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(root, 'flow-typed', file), 'utf8');
  if (!/declare module\s/.test(source)) write('flow-typed/' + file, source);
}
// Check production actions, reducer and SDK contracts; isolate unrelated selectors and navigation.
write(
  'flow-typed/inputs.js',
  `
declare module 'redux/selectors/claims' {
  declare export function selectMyClaims(state: {...}): ?Array<Claim>;
  declare export function selectMyChannelClaims(state: {...}): ?Array<ChannelClaim>;
  declare export function selectReflectingById(state: {...}): {[string]: ReflectingUpdate};
}
declare module 'redux/selectors/publish' {
  declare export function selectPublishFormValues(state: {...}): PublishState;
  declare export function selectMyClaimForUri(state: {...}): ?StreamClaim;
}
declare module 'redux/actions/claims' { declare export function doCheckPendingClaims(): ThunkAction<void>; }
declare module 'redux/actions/notifications' { declare export function doError(message: string): DoError; }
declare module 'redux/actions/app' { declare export function doOpenModal(id: string, data: {...}): {type: string, ...}; }
declare module 'redux-first-history' { declare export function push(path: string): {type: string, ...}; }
declare module 'analytics' { declare export default {apiLogPublish: (Claim) => void}; }
declare module 'util/claim' { declare export function isClaimNsfw(claim: Claim): boolean; }
declare module 'util/lbryURI' { declare export function buildURI(params: LbryUrlObj): string; }
`
);
const fixture = `// @flow
import {doUpdatePublishForm, doPrepareEdit, doPublishDesktop, doUploadThumbnail, doResetThumbnailStatus} from 'redux/actions/publish';
import {publishReducer} from 'redux/reducers/publish';
export const state: PublishState = publishReducer(undefined, {type: 'init'});
export const update: ThunkAction<UpdatePublishFormAction> = doUpdatePublishForm({name: 'new-name'});
export const cleared: ThunkAction<UpdatePublishFormAction> = doUpdatePublishForm({filePath: undefined, thumbnailError: undefined});
export const price: PublishFee = {amount: 1, currency: 'LBC'};
export function sdkFee(value: Fee): PublishFee {return value;}
export function edit(claim: StreamClaim): ThunkAction<void> {return doPrepareEdit(claim, 'lbry://test#id');}
export const preview: ThunkAction<void> = doPublishDesktop('F:/test.mp4', true);
export const reset: ThunkAction<Promise<UpdatePublishFormAction>> = doResetThumbnailStatus();
export function upload(file: File): ThunkAction<Promise<void>> {return doUploadThumbnail(file, (url: string) => {});}
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
assert.deepEqual(check().errors, [], 'Publishing actions, reducer and valid callers must type-check');
const invalid = {
  field: 'export const invalid = doUpdatePublishForm({typo: true});',
  fee: 'export const invalid = doUpdatePublishForm({fee: {amount: true, currency: "LBC"}});',
  tags: 'export const invalid = doUpdatePublishForm({tags: ["tag"]});',
  release: 'export const invalid = doUpdatePublishForm({releaseTimeEdited: "123"});',
  error: 'export const invalid = doUpdatePublishForm({thumbnailError: "failed"});',
  file: 'export function invalid(file: File): void {doUpdatePublishForm({filePath: file});}',
  edit: 'export const invalid = doPrepareEdit({name: "new-name"}, "lbry://test");',
  upload: 'export const invalid = doUploadThumbnail("F:/thumbnail.png");',
  callback: 'export function invalid(file: File): void {doUploadThumbnail(file, (url: number) => {});}',
};
for (const [name, source] of Object.entries(invalid))
  write('invalid-' + name + '.js', fixture + '\n' + source.replace('const invalid =', 'const invalid: unknown ='));
const failed = check();
for (const name of Object.keys(invalid))
  assert(
    failed.errors.some(
      (error) =>
        !error.error_codes.includes('signature-verification-failure') &&
        error.message.some((message) => message.loc?.source.endsWith('invalid-' + name + '.js'))
    ),
    'Incorrect ' + name + ' contract must be rejected'
  );
console.log('PASS publishing action/reducer source and ' + Object.keys(invalid).length + ' invalid contracts');
