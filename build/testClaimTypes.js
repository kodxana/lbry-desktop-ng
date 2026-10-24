/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const parent = path.join(root, 'dist/flow-tests');
fs.mkdirSync(parent, { recursive: true });
const cwd = fs.mkdtempSync(path.join(parent, 'claims-'));
const write = (file, source) => {
  fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  fs.writeFileSync(path.join(cwd, file), source);
};
for (const file of [
  '.flowconfig',
  'ui/redux/selectors/claims.js',
  'ui/constants/claim.js',
  'ui/constants/tags.js',
  'flow-typed/npm/reselect_v5.x.x.js',
]) {
  write(file, fs.readFileSync(path.join(root, file), 'utf8'));
}
for (const file of fs.readdirSync(path.join(root, 'flow-typed')).filter((file) => file.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(root, 'flow-typed', file), 'utf8');
  if (!/declare module\s/.test(source)) write('flow-typed/' + file, source);
}
// Use the installed cached-selector package, as the application does. It has no Flow declarations.
fs.cpSync(path.join(root, 'node_modules/re-reselect'), path.join(cwd, 'node_modules/re-reselect'), { recursive: true });
write(
  'flow-typed/selector-inputs.js',
  `
declare module 'util/lbryURI' {
  declare export function normalizeURI(uri: string): string;
  declare export function isURIValid(uri: ?string): boolean;
  declare export function parseURI(uri: string): LbryUrlObj;
}
declare module 'util/claim' {
  declare export function isClaimNsfw(claim: Claim): boolean;
  declare export function filterClaims(claims: Array<Claim>, query: ?string): Array<Claim>;
}
declare module 'redux/selectors/wallet' {
  declare export function selectSupportsByOutpoint(state: {...}): {[string]: Support};
}
declare module 'lbryinc' {
  declare export function selectBlackListedOutpoints(state: {...}): Array<{txid: string, nout: number}>;
}
`
);
const fixture = fs.readFileSync(path.join(__dirname, 'tests/claimTypes.js'), 'utf8');
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
assert.deepEqual(check().errors, [], 'Claim selectors, shared state and valid callers must type-check');
const invalid = {
  unresolved: 'export const invalid: Claim = selectClaimForUri(state, "lbry://missing");',
  missingId: 'export const invalid: Claim = selectClaimWithId(state, "missing");',
  uriId: 'export const invalid: string = selectClaimIdForUri(state, "lbry://missing");',
  status: 'export const invalid: string = selectCreatingChannel(state);',
  ownership: 'export const invalid: string = selectClaimIsMine(state, stream);',
  pending: 'export const invalid: Array<number> = selectPendingIds(state);',
  page: 'export const invalid = makeSelectClaimsInChannelForPage("lbry://@channel", "2");',
  title: 'export const invalid: number = makeSelectMetadataItemForUri("lbry://stream", "title")(state);',
  languages: 'export const invalid: string = makeSelectMetadataItemForUri("lbry://stream", "languages")(state);',
  metadataKey: 'export const invalid = makeSelectMetadataItemForUri("lbry://stream", "not_a_metadata_field");',
  streamTag: 'export const invalid: StreamClaim = {...channel, value_type: "stream"};',
  channelSource: 'export const invalid: string = channel.value.source.sd_hash;',
  repostTag: 'export const invalid: RepostClaim = stream;',
  repostTarget: 'export const invalid: RepostClaim = {...repost, reposted_claim: "id"};',
  bid: 'export const invalid: StreamClaim = {...stream, amount: 1};',
  stateIds: 'export function invalid(value: ClaimsState): void { value.claimsByUri.uri = false; }',
  statePending: 'export function invalid(value: ClaimsState): void { value.pendingById.id = null; }',
  statePage: 'export function invalid(value: ClaimsState): void { value.myClaimsPageNumber = "2"; }',
  stateChannelCount: 'export function invalid(value: ClaimsState): void { value.channelClaimCounts.uri = "3"; }',
  statePurchase: 'export function invalid(value: ClaimsState): void { value.myPurchases = [42]; }',
  reflecting: 'export const invalid: boolean = makeSelectReflectingClaimForUri("lbry://stream")(state);',
};
for (const [name, source] of Object.entries(invalid)) write('invalid-' + name + '.js', fixture + '\n' + source);
const failed = check();
assert.equal(failed.passed, false);
for (const name of Object.keys(invalid)) {
  assert(
    failed.errors.some((error) =>
      error.message.some((message) => message.loc?.source.endsWith('invalid-' + name + '.js'))
    ),
    'Incorrect ' + name + ' contract must be rejected'
  );
}
console.log(
  'PASS claim selector source, shared claim/state types and ' + Object.keys(invalid).length + ' invalid contracts'
);
