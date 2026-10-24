// @flow
import * as React from 'react';
import CreditAmount from 'component/common/credit-amount';
import Icon from 'component/common/icon';
import { icons } from 'component/common/icon-custom';
import type { IconProps } from 'component/common/icon-custom';
import * as ICONS from 'constants/icons';
import { FREE_GLOBAL_STICKERS, PAID_GLOBAL_STICKERS } from 'constants/stickers';
import type { Sticker } from 'constants/stickers';
import Empty from 'component/common/empty';
import ErrorText from 'component/common/error-text';
import Thumbnail from 'component/common/thumbnail';
import TruncatedText from 'component/common/truncated-text';
import FileList from 'component/common/file-list';
import SettingsRow from 'component/settingsRow/view';
import FormField from 'component/common/form-components/form-field';
import FormFieldPrice from 'component/common/form-components/form-field-price';
import type { FormPrice } from 'component/common/form-components/form-field-price';
import FormRow from 'component/common/form-components/form-row';
import Form from 'component/common/form-components/form';
import type { EditorPosition, EditorChange, EditorBeforeChange, MarkdownCodeMirror } from 'types/markdown-editor';
import WalletBackup from 'component/walletBackup/view';
import { Modal, ExpandableModal } from 'modal/modal';

export const backupWithoutSettings: React.Node = <WalletBackup />;
export const backupBeforeStartup: React.Node = <WalletBackup daemonSettings={{}} />;
export const backupWithDirectory: React.Node = <WalletBackup daemonSettings={{ wallet_dir: 'fixture-wallet' }} />;
export function backupLifecycle(backup: WalletBackup): void {
  backup.mounted = undefined;
  backup.mounted = true;
  backup.backupPending = undefined;
  backup.backupPending = 'fixture-request';
  backup.backupPending = false;
  backup.backupWalletDir(null);
  backup.backupWalletDir(undefined);
  backup.backupWalletDir('fixture-wallet');
}
export const accessibleModal: React.Node = <Modal isOpen contentLabel="Backup" ariaHideApp={false} />;
export const expandableModal: React.Node = <ExpandableModal isOpen extraContent={<p>Details</p>} />;

export const price: FormPrice = { amount: 0.00000001, currency: 'LBC' };
export const position: EditorPosition = { line: 0, ch: 1 };
export const change: EditorChange = { from: position, to: position, text: ['first', 'second'], origin: 'setValue' };
export const beforeChange: EditorBeforeChange = { ...change, cancel() {}, update(from, to, text) {} };
export function editorOptions(editor: MarkdownCodeMirror): void {
  editor.setOption('readOnly', false);
  editor.setOption('placeholder', 'Post text');
}
export const creditDisplay: React.Node = <CreditAmount amount={0.00000001} />;
export const fiatDisplay: React.Node = <CreditAmount customAmounts={{ amountFiat: 1.25, amountLBC: 100 }} />;
const Lock = icons[ICONS.LOCK];
const ref = React.createRef<SVGSVGElement>();
const onChange = (file: File | void): void => {
  if (file) file.name.toUpperCase();
};
export const iconProps: IconProps = { size: 16, color: 'currentColor', title: null, className: 'fixture' };
export const freeSticker: Sticker = { name: ':CAT:', url: 'fixture' };
export const paidSticker: Sticker = { name: ':TIP:', url: 'fixture', price: 1 };
export function stickerPrice(sticker: Sticker): number | void {
  return sticker.price;
}
export const stickers: Array<Sticker> = [...FREE_GLOBAL_STICKERS, ...PAID_GLOBAL_STICKERS];
export const content: React.Node = (
  <>
    <Form className="fixture-form" onSubmit={() => {}}>
      <FormRow padded>
        <FormField name="password" type="password" autoFocus />
        <FormField name="remember" type="checkbox" checked={false} />
        <FormField name="amount" type="number" step="any" value={0.00000001} />
        <FormField
          name="message"
          type="text"
          error={{ message: 'Fixture' }}
          maxLength={10}
          onBlur={(event) => event.target.value.toUpperCase()}
        />
        <FormFieldPrice name="price" min={0} price={price} step={null} onChange={(value: FormPrice): void => {}} />
      </FormRow>
    </Form>
    <Lock />
    <Lock {...iconProps} ref={ref} aria-hidden />
    <Icon icon={ICONS.LOCK} tooltip customTooltipText="Wallet" sectionIcon />
    <Empty text="" />
    <ErrorText>fixture error</ErrorText>
    <Thumbnail src="fixture" shouldObscure={false} />
    <TruncatedText lines={2} text={null}>
      <strong>Fixture</strong>
    </TruncatedText>
    <FileList files={[]} onChange={onChange} />
    <SettingsRow title="Wallet" footer={<em>Fixture footer</em>}>
      <span>Value</span>
    </SettingsRow>
  </>
);
