/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const parent = path.join(root, 'dist', 'flow-tests');
fs.mkdirSync(parent, { recursive: true });
const cwd = fs.mkdtempSync(path.join(parent, 'utilities-'));
const write = (file, source) => {
  const target = path.join(cwd, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
};
const sources = [
  'ui/util/intlNumberFormat.js',
  'ui/util/number.js',
  'ui/util/format-bytes.js',
  'ui/util/format-credits.js',
  'ui/util/string.js',
  'ui/util/time.js',
  'ui/util/wallet-sync.js',
  'ui/util/startup-progress.js',
  'ui/util/query-params.js',
];
for (const file of [...sources, '.flowconfig']) write(file, fs.readFileSync(path.join(root, file), 'utf8'));
for (const file of fs.readdirSync(path.join(root, 'flow-typed')).filter((file) => file.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(root, 'flow-typed', file), 'utf8');
  if (!/declare module\s/.test(source)) write('flow-typed/' + file, source);
}
write(
  'ui/constants/action_types.js',
  '// @flow\n' + fs.readFileSync(path.join(root, 'ui/constants/action_types.js'), 'utf8')
);
write('ui/constants/search.js', fs.readFileSync(path.join(root, 'ui/constants/search.js'), 'utf8'));
const fixture = fs.readFileSync(path.join(__dirname, 'tests/utilityTypes.js'), 'utf8');
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
  const report = JSON.parse(result.stdout);
  assert.equal(report.passed, result.status === 0);
  return report;
};
assert.deepEqual(check().errors, [], 'Shared utility source and valid callers must type-check');
const invalid = {
  searchSize: 'export const invalid: string = getSearchQueryString("test", {size: "20"});',
  searchMature: 'export const invalid: string = getSearchQueryString("test", {nsfw: "false"});',
  searchMedia: 'export const invalid: string = getSearchQueryString("test", {video: "true"});',
  searchType: 'export const invalid: string = getSearchQueryString("test", {claimType: ["file"]});',
  searchQuery: 'export const invalid: string = getSearchQueryString(null);',
  queryResult: 'export const invalid: string = parseQueryParams("flag").flag;',
  queryUpdate: 'export const invalid: string = updateQueryParam("x", "page", 2);',
  searchCache: 'export function invalid(state: SearchState): Array<string> { return state.resultsByQuery["query"]; }',
  searchEnd:
    'export function invalid(state: SearchState): boolean { return state.hasReachedMaxResultsLength["query"]; }',
  searchProvider:
    'export function invalid(state: SearchState): string { return state.resultsByQuery["query"].recsys; }',

  number: 'export const invalid: string = formatNumber("10");',
  numberResult: 'export const invalid: number = formatNumber(10);',
  bytes: 'export const invalid: string = formatBytes("1024");',
  bytePrecision: 'export const invalid: string = formatBytes(1024, "2");',
  credits: 'export const invalid: string = formatCredits({amount: "10"});',
  creditPrecision: 'export const invalid: string = formatCredits("10", "2");',
  fullPrice: 'export const invalid: number = formatFullPrice(null);',
  creditString: 'export const invalid: number = creditsToString("1.00000001");',
  compact: 'export const invalid: string = toCompactNotation(true, "en");',
  seconds: 'export const invalid: string = secondsToHms("3600");',
  timeResult: 'export const invalid: string = hmsToSeconds("01:00");',
  formatter: 'export const invalid: Intl.NumberFormat = getFormatter("en", {maximumFractionDigits: "2"});',
  snapshotBalance:
    'export const invalid: Promise<{status: StatusResponse | null, balance: BalanceResponse}> = readWalletSnapshot({status: async (): Promise<StatusResponse> => status, wallet_balance: async () => ({available: 1, reserved: "0", reserved_subtotals: null, total: "1"})});',
  snapshotAsync:
    'export const invalid: Promise<{status: StatusResponse | null, balance: BalanceResponse}> = readWalletSnapshot({status: () => status, wallet_balance: async (): Promise<BalanceResponse> => balance});',
  snapshotNullable:
    'export async function invalid(): Promise<boolean> { const snapshot = await readWalletSnapshot(sdk); return snapshot.status.is_running; }',
  walletProgress: 'export const invalid: WalletSyncProgress = {...walletSyncProgress(null), pending: "yes"};',
  startupStep: 'export const invalid: StartupProgress = {...startupProgress(null), step: 3};',
  startupLocked: 'export const invalid: StartupProgress = startupProgress(status, "yes");',
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
  'PASS shared utility source contracts and ' +
    Object.keys(invalid).length +
    ' invalid formatting, wallet and search contracts'
);
