/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const parent = path.join(root, 'dist', 'flow-tests');
fs.mkdirSync(parent, { recursive: true });
const cwd = fs.mkdtempSync(path.join(parent, 'contracts-'));
const write = (file, source) => {
  const target = path.join(cwd, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
};
write('.flowconfig', fs.readFileSync(path.join(root, '.flowconfig'), 'utf8'));
let count = 0;
// This gate covers first-party globals. Third-party module definitions need a separate migration.
for (const file of fs.readdirSync(path.join(root, 'flow-typed')).filter((file) => file.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(root, 'flow-typed', file), 'utf8');
  if (/declare module\s/.test(source)) {
    assert(!/^declare (type|class|var|function|interface)\s/m.test(source), `Mixed module/global definitions: ${file}`);
    continue;
  }
  write(`flow-typed/${file}`, source);
  count++;
}
assert(count > 0, 'The gate must load the real domain definitions');
// Type-check against the actual action constants, not copies of their expected strings.
write(
  'ui/constants/action_types.js',
  '// @flow\n' + fs.readFileSync(path.join(root, 'ui/constants/action_types.js'), 'utf8')
);
const fixture = fs.readFileSync(path.join(__dirname, 'tests/flowContracts.js'), 'utf8');
write('ui/contracts.js', fixture);
const check = () => {
  const result = spawnSync(require('flow-bin'), ['full-check', '--max-workers', '2', '--json', '--strip-root'], {
    cwd,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert([0, 2].includes(result.status), result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.passed, result.status === 0);
  return report;
};
assert.deepEqual(check().errors, [], 'All first-party global definitions and valid contracts must type-check');

const invalid = {
  balance: 'export const value: BalanceResponse = {available: 1, reserved: "0", total: "1", reserved_subtotals: null};',
  fee: 'export const value: Fee = {amount: 1, currency: "LBC", address: "fixture"};',
  receipt: 'export function bad(value: PurchaseReceipt): PurchaseReceipt { return {...value, amount: 1}; }',
  disk: 'export const value: DiskSpace = {total: 100, free: "50"};',
  completed: 'export function bad(value: FileListItem): FileListItem { return {...value, completed: "true"}; }',
  stopped: 'export function bad(value: FileListItem): FileListItem { return {...value, stopped: 1}; }',
  location: 'export const value: ClaimLocation = {latitude: "north"};',
  comment: 'export function bad(value: LbryComment): LbryComment { return {...value, comment_id: 1}; }',
  pin: 'export const value: CommentPinResponse = {item: comment}; declare var comment: LbryComment;',
  notification: 'export function bad(value: WebNotification): WebNotification { return {...value, id: "1"}; }',
  search: 'export const value: SearchOptions = {size: "20", video: "yes"};',
  action:
    'export const value: PurchaseUriCompleted = {type: "PURCHASE_URI_FAILED", data: {uri: "lbry://test", streamingUrl: "http://localhost"}};',
  payload:
    'export const value: MentionSearchResults = {type: "SET_MENTION_SEARCH_RESULTS", data: {query: "test", uris: [1]}};',
};
for (const [name, source] of Object.entries(invalid)) write(`ui/invalid-${name}.js`, '// @flow\n' + source);
const failed = check();
assert.equal(failed.passed, false);
for (const name of Object.keys(invalid)) {
  assert(
    failed.errors.some((error) => error.message.some((message) => message.loc?.source.endsWith(`invalid-${name}.js`))),
    `Incorrect ${name} contract must be rejected`
  );
}
console.log(`PASS ${count} first-party Flow definition files, real action constants, DOM types and invalid contracts`);
