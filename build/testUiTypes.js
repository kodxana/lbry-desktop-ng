/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const parent = path.join(root, 'dist', 'flow-tests');
fs.mkdirSync(parent, { recursive: true });
const cwd = fs.mkdtempSync(path.join(parent, 'ui-'));
const write = (file, source) => {
  const target = path.join(cwd, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
};
const sources = [
  'ui/constants/icons.js',
  'ui/constants/stickers.js',
  'ui/component/common/icon-custom.jsx',
  'ui/component/common/icon.jsx',
  'ui/component/common/empty.jsx',
  'ui/component/common/error-text.jsx',
  'ui/component/common/thumbnail.jsx',
  'ui/component/common/truncated-text.jsx',
  'ui/component/common/file-list.jsx',
  'ui/component/settingsRow/view.jsx',
  'ui/component/common/credit-amount.jsx',
  'ui/component/common/lbc-symbol.jsx',
  'ui/util/format-credits.js',
  'ui/util/intlNumberFormat.js',
  'ui/constants/form-field.js',
  'ui/types/markdown-editor.js',
  'ui/component/common/form-components/form-field.jsx',
  'ui/component/common/form-components/form-field-price.jsx',
  'ui/component/common/form-components/form-row.jsx',
  'ui/component/common/form-components/form.jsx',
];
for (const file of [...sources, '.flowconfig', 'flow-typed/i18n.js', 'flow-typed/npm/classnames_v2.x.x.js']) {
  write(file, fs.readFileSync(path.join(root, file), 'utf8'));
}
fs.cpSync(path.join(root, 'node_modules/uuid'), path.join(cwd, 'node_modules/uuid'), { recursive: true });
write(
  'node_modules/easymde/dist/easymde.min.css',
  fs.readFileSync(path.join(root, 'node_modules/easymde/dist/easymde.min.css'), 'utf8')
);
const fixture = fs.readFileSync(path.join(__dirname, 'tests/uiTypes.jsx'), 'utf8');
write('valid.jsx', fixture);
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
assert.deepEqual(check().errors, [], 'Shared UI source and valid callers must type-check');
const invalid = {
  priceAmount: 'export const value: FormPrice = {amount: "1", currency: "LBC"};',
  priceCurrency: 'export const value: FormPrice = {amount: 1, currency: false};',
  priceStep:
    'export const value: React.Node = <FormFieldPrice name="price" min={0} price={price} step="any" onChange={() => {}} />;',
  priceChange:
    'export const value: React.Node = <FormFieldPrice name="price" min={0} price={price} onChange={(value: string): void => {}} />;',
  fieldChecked: 'export const value: React.Node = <FormField name="enabled" type="checkbox" checked="yes" />;',
  fieldMaxLength: 'export const value: React.Node = <FormField name="text" type="text" maxLength="10" />;',
  fieldError: 'export const value: React.Node = <FormField name="text" type="text" error={{message: 42}} />;',
  editorPosition: 'export const value: EditorPosition = {line: 0, ch: "1"};',
  editorChange: 'export const value: EditorChange = {...change, text: "line"};',
  editorUpdate: 'export const value: EditorBeforeChange = {...change, cancel() {}, update(from, to, text: string) {}};',
  editorReadOnly:
    'export function invalid(editor: MarkdownCodeMirror): void { editor.setOption("readOnly", "false"); }',
  creditAmount: 'export const value: React.Node = <CreditAmount amount="1" />;',
  creditPrecision: 'export const value: React.Node = <CreditAmount amount={1} precision="8" />;',
  fiatAmount: 'export const value: React.Node = <CreditAmount customAmounts={{amountFiat: "1", amountLBC: 100}} />;',
  iconSize: 'export const value: React.Node = <Lock size="24" />;',
  iconColor: 'export const value: React.Node = <Lock color={123} />;',
  iconTitle: 'export const value: IconProps = {title: {text: "Wallet"}};',
  iconRef: 'export const value: React.Node = <Lock ref={React.createRef<HTMLDivElement>()} />;',
  iconName: 'export const value: React.Node = <Icon icon={42} />;',
  stickerName: 'export const value: Sticker = {name: 1, url: "fixture"};',
  stickerUrl: 'export const value: Sticker = {name: ":CAT:", url: 123};',
  stickerPrice: 'export const value: Sticker = {name: ":TIP:", url: "fixture", price: "1"};',
  emptyText: 'export const value: React.Node = <Empty text={{message: "Nothing"}} />;',
  errorText: 'export const value: React.Node = <ErrorText>{123}</ErrorText>;',
  thumbnail: 'export const value: React.Node = <Thumbnail src="fixture" shouldObscure="yes" />;',
  truncated: 'export const value: React.Node = <TruncatedText text="Fixture" lines="two" />;',
  files: 'export const value: React.Node = <FileList files={[123]} onChange={() => {}} />;',
  fileChange: 'export const value: React.Node = <FileList files={[]} onChange={(file: string): void => {}} />;',
  settings: 'export const value: React.Node = <SettingsRow title={123} />;',
};
for (const [name, source] of Object.entries(invalid)) write('invalid-' + name + '.jsx', fixture + '\n' + source);
const failed = check();
assert.equal(failed.passed, false);
for (const name of Object.keys(invalid)) {
  assert(
    failed.errors.some((error) =>
      error.message.some((message) => message.loc?.source.endsWith('invalid-' + name + '.jsx'))
    ),
    'Incorrect ' + name + ' contract must be rejected'
  );
}
console.log(
  'PASS shared UI source contracts and ' + Object.keys(invalid).length + ' invalid icon, sticker and component props'
);
