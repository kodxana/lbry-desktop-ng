// @flow
import React from 'react';
import desktop from 'util/desktop';
import Button from 'component/button';
import HubSetup from 'component/hubSetup';
import WalletSetup from 'component/walletSetup';
import SplashScreen from 'component/splash';
import SetupLayout from 'component/setupLayout';

type Props = { onReadyToLaunch: () => void };

export default function SdkStartup({ onReadyToLaunch }: Props): React.Node {
  const [phase, setPhase] = React.useState('loading');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let active = true;
    desktop
      .startupState()
      .then((state) => {
        if (active) setPhase(state.walletSetup ? 'wallet' : state.settingsOnly ? 'choose' : 'sync');
      })
      .catch(() => {
        if (active) setError(__('Could not read startup state. Please close and reopen the app.'));
      });
    return () => {
      active = false;
    };
  }, []);

  async function chooseHub() {
    // Unmount the sync poller before stopping its SDK.
    setPhase('loading');
    setError('');
    try {
      await desktop.prepareHubs();
      setPhase('choose');
    } catch (_) {
      setError(__('Could not prepare hub selection. You can retry or close the app and check the SDK logs.'));
    }
  }

  if (phase === 'sync') return <SplashScreen onReadyToLaunch={onReadyToLaunch} onChooseHub={chooseHub} />;
  if (phase === 'wallet') return <WalletSetup onContinue={() => setPhase('choose')} />;
  if (phase === 'choose') return <HubSetup handleNextPage={() => setPhase('sync')} />;
  return (
    <SetupLayout>
      <h1 className="section__title--large">{__('Preparing wallet setup')}</h1>
      <p className="section__subtitle" role="status">
        {__('Preparing your connection settings. Your wallet will sync after you choose a hub.')}
      </p>
      {error && (
        <p className="error__text" role="alert">
          {error}
        </p>
      )}
      {error && <Button button="primary" label={__('Retry')} onClick={chooseHub} />}
    </SetupLayout>
  );
}
