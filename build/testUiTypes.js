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
  'ui/component/walletBackup/view.jsx',
  'ui/modal/modal.jsx',
];
for (const file of [
  ...sources,
  '.flowconfig',
  'flow-typed/i18n.js',
  'flow-typed/npm/classnames_v2.x.x.js',
  'flow-typed/npm/react-modal_v3.x.x.js',
]) {
  write(file, fs.readFileSync(path.join(root, file), 'utf8'));
}
// Isolate presentation and IPC dependencies while checking the real backup and modal sources.
write(
  'ui/component/button.js',
  `// @flow
import type {Node} from 'react';
type Props = {button?: string, label?: Node, children?: Node, href?: string,
  disabled?: boolean, onClick?: () => unknown, icon?: string, iconSize?: number, 'aria-label'?: string};
export default function Button(props: Props): Node { return null; }
`
);
write(
  'ui/component/common/card.jsx',
  `// @flow
import type {Node} from 'react';
export default function Card(props: {title?: Node, subtitle?: Node, actions?: Node}): Node { return null; }
`
);
write(
  'ui/component/copyableText.js',
  `// @flow
import type {Node} from 'react';
export default function CopyableText(props: {copyable?: ?string, snackMessage?: string}): Node { return null; }
`
);
write(
  'ui/component/i18nMessage.js',
  `// @flow
import type {Node} from 'react';
export default function I18nMessage(props: {tokens: {[string]: Node}, children: string}): Node { return null; }
`
);
write(
  'ui/effects/use-screensize.js',
  `// @flow
export function useIsMobile(): boolean { return false; }
`
);
write(
  'ui/util/desktop.js',
  `// @flow
type BackupResult = {ok: true, path: string} | {ok: false, error: string};
declare const desktop: {
  backupWallet: ({id: string, directory: string}) => Promise<BackupResult>,
  cancelBackup: (string) => void,
  openWalletFolder: () => void,
};
export default desktop;
`
);
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
  iconLabel: 'export const value: React.Node = <Icon icon="lock" aria-label={123} />;',
  fieldKey: 'export const value: React.Node = <FormField name="list" onKeyDown={(event: number): void => {}} />;',
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
  walletDirectory: 'export const value: React.Node = <WalletBackup daemonSettings={{wallet_dir: 123}} />;',
  walletPending: 'export function invalid(backup: WalletBackup): void { backup.backupPending = true; }',
  walletMounted: 'export function invalid(backup: WalletBackup): void { backup.mounted = "yes"; }',
  walletBackup: 'export function invalid(backup: WalletBackup): void { backup.backupWalletDir(123); }',
  modalOpen: 'export const value: React.Node = <Modal isOpen="yes" />;',
  modalLabel: 'export const value: React.Node = <Modal contentLabel={42} />;',
  modalAria: 'export const value: React.Node = <Modal ariaHideApp="false" />;',
  modalConfirm: 'export const value: React.Node = <Modal confirmButtonDisabled="yes" />;',
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
  'PASS shared UI source contracts and ' + Object.keys(invalid).length + ' invalid component and backup contracts'
);
