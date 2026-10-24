// @flow
import { formatCredits, formatFullPrice } from 'util/format-credits';
import classnames from 'classnames';
import LbcSymbol from 'component/common/lbc-symbol';
import React from 'react';

type Props = {
  amount?: number,
  className?: string,
  customAmounts?: { amountFiat: number, amountLBC: number },
  fee?: boolean,
  isEstimate?: boolean,
  isFiat?: boolean,
  noFormat?: boolean,
  precision: number,
  showFree: boolean,
  showFullPrice: boolean,
  showLBC?: boolean,
  showPlus: boolean,
  size?: number,
  superChat?: boolean,
  superChatLight?: boolean,
};

class CreditAmount extends React.PureComponent<Props> {
  static defaultProps: {
    noFormat: boolean,
    precision: number,
    showFree: boolean,
    showFullPrice: boolean,
    showLBC: boolean,
    showPlus: boolean,
  } = {
    noFormat: false,
    precision: 2,
    showFree: false,
    showFullPrice: false,
    showLBC: true,
    showPlus: false,
  };

  render(): React.Node {
    const {
      amount,
      className,
      customAmounts,
      fee,
      isEstimate,
      isFiat,
      noFormat,
      precision,
      showFree,
      showFullPrice,
      showLBC,
      showPlus,
      size,
      superChat,
      superChatLight,
    } = this.props;
    const minimumRenderableAmount = 10 ** (-1 * precision);

    // return null, otherwise it will try and convert undefined to a string
    if (amount === undefined && customAmounts === undefined) return null;

    function getAmountText(amount: number, isFiat?: boolean): React.Node {
      const fullPrice = formatFullPrice(amount, 2);
      const isFree = parseFloat(amount) === 0;
      let formattedAmount;

      if (showFullPrice) {
        formattedAmount = fullPrice;
      } else {
        formattedAmount =
          amount > 0 && amount < minimumRenderableAmount
            ? `<${minimumRenderableAmount}`
            : formatCredits(amount, precision, true);
      }

      if (showFree && isFree) {
        return __('Free');
      } else {
        let amountText: string | number = noFormat ? amount : formattedAmount;

        if (showPlus && amount > 0) {
          amountText = `+${amountText}`;
        }

        let renderedAmount: React.Node = amountText;
        if (showLBC && !isFiat) {
          renderedAmount = <LbcSymbol postfix={amountText} size={size} />;
        } else if (showLBC && isFiat) {
          renderedAmount = (
            <p style={{ display: 'inline' }}> ${(Math.round(Number(amountText) * 100) / 100).toFixed(2)}</p>
          );
        }

        if (fee) {
          renderedAmount = __('%amount% fee', { amount: renderedAmount });
        }

        return renderedAmount;
      }
    }

    return (
      <span
        title={amount ? formatFullPrice(amount, 2) : ''}
        className={classnames(className, {
          'super-chat': superChat,
          'super-chat--light': superChatLight,
        })}
      >
        {customAmounts
          ? Object.values(customAmounts).map((amount, index) => (
              <span key={String(amount)} className="credit-amount">
                {getAmountText(Number(amount), !index)}
              </span>
            ))
          : amount && <span className="credit-amount">{getAmountText(amount, isFiat)}</span>}

        {isEstimate ? (
          <span className="credit-amount__estimate" title={__('This is an estimate and does not include data fees')}>
            *
          </span>
        ) : null}
      </span>
    );
  }
}

export default CreditAmount;
