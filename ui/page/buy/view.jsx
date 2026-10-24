// @flow
import React from 'react';
import Page from 'component/page';
import Card from 'component/common/card';
import Spinner from 'component/spinner';
import signQuery from 'util/sign-query';
import { countryOptions } from 'util/country';
import { FormField } from 'component/common/form';
import { SUPPORTED_MOONPAY_COUNTRIES } from 'constants/moonpay';
import { useDesktopHistory } from 'component/common/desktop-router';
import Button from 'component/button';
import Nag from 'component/common/nag';
import I18nMessage from 'component/i18nMessage';
import LbcSymbol from 'component/common/lbc-symbol';

const MOONPAY_KEY = process.env.MOONPAY_SECRET_KEY;
// Keep the existing provider allowlist when the country dataset changes its names.
const PROVIDER_COUNTRY_NAMES: { [string]: string } = { Turkiye: 'Turkey', Vietnam: 'Viet Nam' };

type Props = {
  receiveAddress: ?string,
  gettingNewAddress: boolean,
  email: string,
  user: ?User,
  doGetNewAddress: () => void,
  doUserSetCountry: (string) => void,
};

export default function BuyPage(props: Props): React.Node {
  const { receiveAddress, gettingNewAddress, doGetNewAddress, email, user, doUserSetCountry } = props;
  const initialCountry = (user && user.country) || '';
  const [signedPurchase, setSignedPurchase] = React.useState<{
    address: string,
    email: string,
    url?: string,
    error?: boolean,
  } | void>();
  const [country, setCountry] = React.useState(initialCountry);
  const [showPurchaseScreen, setShowPurchaseScreen] = React.useState(false);
  const isValid = SUPPORTED_MOONPAY_COUNTRIES.includes(PROVIDER_COUNTRY_NAMES[country] || country);
  const { goBack } = useDesktopHistory();
  const currentPurchase =
    signedPurchase && signedPurchase.address === receiveAddress && signedPurchase.email === email
      ? signedPurchase
      : null;
  const url = currentPurchase && currentPurchase.url;

  React.useEffect(() => {
    if (country) {
      doUserSetCountry(country);
    }
  }, [country, doUserSetCountry, isValid, setShowPurchaseScreen]);

  React.useEffect(() => {
    if (!receiveAddress && !gettingNewAddress) {
      doGetNewAddress();
    }
  }, [doGetNewAddress, receiveAddress, gettingNewAddress]);

  React.useEffect(() => {
    let cancelled = false;
    if (MOONPAY_KEY && receiveAddress) {
      let url = `https://buy.moonpay.io?apiKey=pk_live_xNFffrN5NWKy6fu0ggbV8VQIwRieRzy&colorCode=%23257761&currencyCode=lbc&showWalletAddressForm=true&walletAddress=${receiveAddress}`;

      if (email) {
        url += `&email=${encodeURIComponent(email)}`;
      }

      url += `&enabledPaymentMethods=${encodeURIComponent('credit_debit_card,sepa_bank_transfer,gbp_bank_transfer')}`;

      const query = new URL(url).search;
      signQuery(query, MOONPAY_KEY)
        .then((signature) => {
          if (!cancelled) {
            setSignedPurchase({
              address: receiveAddress,
              email,
              url: `${url}&signature=${encodeURIComponent(signature)}`,
            });
          }
        })
        .catch(() => {
          if (!cancelled) setSignedPurchase({ address: receiveAddress, email, error: true });
        });
    }
    return () => {
      cancelled = true;
    };
  }, [receiveAddress, email]);

  const title = __('Buy Credits');
  const subtitle = (
    <I18nMessage
      tokens={{
        learn_more: <Button button="link" label={__('Learn more')} href="https://lbry.com/faq/buy-lbc" />,
      }}
    >
      LBRY, Inc. partners with Moonpay to provide the option to purchase LBRY Credits. %learn_more%.
    </I18nMessage>
  );

  return (
    <Page
      noSideNavigation
      className="main--swap"
      backout={{
        backoutLabel: __('Done'),
        title: <LbcSymbol prefix={__('Buy LBC')} size={28} />,
      }}
    >
      <div className="section">
        <>
          {!user && (
            <div className="main--empty">
              <Spinner delayed />
            </div>
          )}

          {user && (
            <>
              {showPurchaseScreen ? (
                <Card
                  title={title}
                  subtitle={subtitle}
                  actions={
                    url ? (
                      <iframe
                        allow="accelerometer; autoplay; camera; gyroscope; payment"
                        frameBorder="0"
                        src={url}
                        width="100%"
                      >
                        <p>{__('Your browser does not support iframes.')}</p>
                      </iframe>
                    ) : !MOONPAY_KEY || (currentPurchase && currentPurchase.error) ? (
                      <p role="alert">{__('Unable to prepare the purchase. Please go back and try again.')}</p>
                    ) : (
                      <div className="main--empty">
                        <Spinner delayed />
                      </div>
                    )
                  }
                />
              ) : (
                <Card
                  title={title}
                  subtitle={subtitle}
                  nag={
                    country && !isValid && <Nag relative type="helpful" message={"This country isn't supported yet."} />
                  }
                  actions={
                    <div>
                      <div className="section">
                        <FormField
                          label={__('Country')}
                          type="select"
                          name="country-codes"
                          helper={__(
                            'Only some countries are eligible at this time. We are working to make this available to everyone.'
                          )}
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                        >
                          <option value="" disabled defaultValue>
                            {__('Select your country')}
                          </option>
                          {countryOptions(country).map((country) => (
                            <option key={country} value={country}>
                              {country}
                            </option>
                          ))}
                        </FormField>
                      </div>
                      {country && (
                        <div className="section">
                          {isValid ? (
                            <div className="section__actions">
                              <Button
                                button="primary"
                                label={__('Continue')}
                                onClick={() => setShowPurchaseScreen(true)}
                              />
                            </div>
                          ) : (
                            <div className="section__actions">
                              <Button button="alt" label={__('Go Back')} onClick={() => goBack()} />
                              <Button
                                button="link"
                                label={__('Try Anyway')}
                                onClick={() => setShowPurchaseScreen(true)}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  }
                />
              )}
            </>
          )}
        </>
      </div>
    </Page>
  );
}
