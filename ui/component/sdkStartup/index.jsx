// @flow
import React from 'react';
import { ipcRenderer } from 'electron';
import Button from 'component/button';
import HubSetup from 'component/hubSetup';
import SplashScreen from 'component/splash';

type Props = { onReadyToLaunch: () => void };

export default function SdkStartup({ onReadyToLaunch }: Props) {
  const [phase, setPhase] = React.useState('loading');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let active = true;
    ipcRenderer.invoke('hub-startup-state').then(state => {
      if (active) setPhase(state.settingsOnly ? 'choose' : 'sync');
    }).catch(() => {
      if (active) setError(__('Could not read startup state. Please close and reopen the app.'));
    });
    return () => { active = false };
  }, []);

  async function chooseHub() {
    // Unmount the sync poller before stopping its SDK.
    setPhase('loading');
    setError('');
    try {
      await ipcRenderer.invoke('hub-servers-prepare');
      setPhase('choose');
    } catch (_) {
      setError(__('Could not prepare hub selection. You can retry or close the app and check the SDK logs.'));
    }
  }

  if (phase === 'sync') return <SplashScreen onReadyToLaunch={onReadyToLaunch} onChooseHub={chooseHub} />;
  return (
    <main className="main--launching">
      {phase === 'choose' ? <HubSetup handleNextPage={() => setPhase('sync')} /> : (
        <section className="main--contained">
          <h1>{__('Preparing wallet setup…')}</h1>
          {error && <p role="alert">{error}</p>}
          {error && <Button button="primary" label={__('Retry')} onClick={chooseHub} />}
        </section>
      )}
    </main>
  );
}
