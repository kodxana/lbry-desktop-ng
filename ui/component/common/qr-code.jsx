// @flow
import React from 'react';
import classnames from 'classnames';
import { QRCodeCanvas } from 'qrcode.react';

type Props = {
  value: string,
  paddingRight?: boolean,
  paddingTop?: boolean,
};

class QRCode extends React.Component<Props> {
  static defaultProps: { paddingRight: boolean, paddingTop: boolean } = {
    paddingRight: false,
    paddingTop: false,
  };

  render(): React.Node {
    const { value, paddingRight, paddingTop } = this.props;
    return (
      <div
        className={classnames('qr-code', {
          'qr-code--right-padding': paddingRight,
          'qr-code--top-padding': paddingTop,
        })}
      >
        {value && <QRCodeCanvas value={value} marginSize={4} aria-label={__('Wallet receive address QR code')} />}
      </div>
    );
  }
}

export default QRCode;
