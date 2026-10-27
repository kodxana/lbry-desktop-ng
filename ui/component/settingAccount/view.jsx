// @flow
import * as ICONS from 'constants/icons';
import * as PAGES from 'constants/pages';
import { SETTINGS_GRP } from 'constants/settings';
import React from 'react';
import Button from 'component/button';
import Card from 'component/common/card';
import SettingsRow from 'component/settingsRow';
import SyncToggle from 'component/syncToggle';
import { getSavedPasswordState } from 'util/saved-passwords';
import desktop from 'util/desktop';

type Props = {
  isAuthenticated: boolean,
  walletEncrypted: boolean,
  user: User,
  hasChannels: boolean,
  doWalletStatus: () => void,
};

export default function SettingAccount(props: Props): React.Node {
  const { isAuthenticated, walletEncrypted, hasChannels, doWalletStatus } = props;
  const [storedPassword, setStoredPassword] = React.useState(false);
  const [setupError, setSetupError] = React.useState('');
  const [openingSetup, setOpeningSetup] = React.useState(false);
  const localWallet = desktop.walletCloudSyncEnabled() === false;

  // Determine if password is stored.
  React.useEffect(() => {
    doWalletStatus();
    let active = true;
    getSavedPasswordState().then(({ remembered }) => {
      if (active) setStoredPassword(remembered);
    });
    return () => {
      active = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="card__title-section">
        <h2 className="card__title">{__('Account')}</h2>
      </div>

      <Card
        id={SETTINGS_GRP.ACCOUNT}
        isBodyList
        body={
          <>
            {isAuthenticated && (
              <SettingsRow title={__('Password')}>
                <Button
                  button="inverse"
                  label={__('Manage')}
                  icon={ICONS.ARROW_RIGHT}
                  navigate={`/$/${PAGES.SETTINGS_UPDATE_PWD}`}
                />
              </SettingsRow>
            )}

            {localWallet ? (
              <SettingsRow
                title={__('Odysee wallet sync is off')}
                subtitle={__('This separate profile keeps its wallet local. Signing in does not upload or replace it.')}
              />
            ) : (
              <SyncToggle disabled={walletEncrypted && !storedPassword} />
            )}
            <SettingsRow
              title={__('Wallet setup')}
              subtitle={__('Import a wallet copy, start fresh or return to another NG profile. The app will restart.')}
            >
              <Button
                button="inverse"
                label={__('Open wallet setup')}
                disabled={openingSetup}
                onClick={async () => {
                  setOpeningSetup(true);
                  setSetupError('');
                  try {
                    await desktop.walletSetup('open');
                  } catch (_) {
                    setSetupError(__('Could not open wallet setup. Close and reopen the app.'));
                    setOpeningSetup(false);
                  }
                }}
              />
              {setupError && <p role="alert">{setupError}</p>}
            </SettingsRow>

            {hasChannels && (
              <SettingsRow title={__('Comments')} subtitle={__('View your past comments.')}>
                <Button
                  button="inverse"
                  label={__('Manage')}
                  icon={ICONS.ARROW_RIGHT}
                  navigate={`/$/${PAGES.SETTINGS_OWN_COMMENTS}`}
                />
              </SettingsRow>
            )}
          </>
        }
      />
    </>
  );
}
