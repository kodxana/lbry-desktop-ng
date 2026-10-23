// @flow
import * as React from 'react';
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
