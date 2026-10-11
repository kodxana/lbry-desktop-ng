// @flow
import React from 'react';
import { ipcRenderer } from 'electron';
import Button from 'component/button';
import { FormField } from 'component/common/form-components/form-field';

type Server = { endpoint: string, host: string, port: number, latency: ?number, error: ?string };
type Props = { handleNextPage: () => void };

function errorMessage(error: Error) {
  return error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

export default function HubSetup({ handleNextPage }: Props) {
  const [servers, setServers] = React.useState<Array<Server>>([]);
  const [selected, setSelected] = React.useState(null);
  const [scanning, setScanning] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [customAddress, setCustomAddress] = React.useState('');
  const mounted = React.useRef(true);

  async function scan() {
    setScanning(true);
    setError('');
    try {
      const result = await ipcRenderer.invoke('hub-servers-scan');
      if (mounted.current) {
        setServers(result.servers);
        setSelected(null);
      }
    } catch (error) {
      if (mounted.current) setError(errorMessage(error));
    } finally {
      if (mounted.current) setScanning(false);
    }
  }

  React.useEffect(() => {
    scan();
    return () => { mounted.current = false };
  }, []);

  async function checkCustom() {
    setScanning(true);
    setError('');
    try {
      const server = await ipcRenderer.invoke('hub-servers-check', customAddress.trim());
      if (mounted.current) {
        setServers(previous => [server, ...previous.filter(item => item.endpoint !== server.endpoint)]);
        if (!server.error) setSelected(server.endpoint);
        else setError(__('That hub did not pass the connection check. Try another address.'));
      }
    } catch (error) {
      if (mounted.current) setError(errorMessage(error));
    } finally {
      if (mounted.current) setScanning(false);
    }
  }

  async function next() {
    setSaving(true);
    setError('');
    try {
      await ipcRenderer.invoke('hub-servers-select', selected);
      if (mounted.current) handleNextPage();
    } catch (error) {
      if (mounted.current) setError(errorMessage(error));
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <section className="main--contained hub-setup">
      <h1 className="section__title--large">{__('Choose a wallet hub')}</h1>
      <p>{__('Wallet sync is paused until you choose a hub.')}</p>
      <p>{__('Hubs connect your wallet to the LBRY network. Keep automatic selection or choose a responding server.')}</p>
      <p className="help">{__('Response time includes connecting and checking the LBRY protocol. It can change over time.')}</p>
      <fieldset disabled={saving || scanning}>
        <legend className="section__subtitle">{__('Hub servers')}</legend>
        <FormField
          name="wallet-hub-auto"
          type="radio"
          checked={selected === null}
          label={__('Automatic selection (recommended)')}
          helper={__('Let the SDK choose a hub and switch if it becomes unavailable.')}
          onChange={() => setSelected(null)}
        />
        <div className="hub-setup__servers">
          {servers.map(server => (
            <FormField
              key={server.endpoint}
              name={`wallet-hub-${server.endpoint}`}
              type="radio"
              disabled={Boolean(server.error)}
              checked={selected === server.endpoint}
              label={`${server.endpoint} — ${server.error ? __(server.error) : `${server.latency} ms`}`}
              onChange={() => setSelected(server.endpoint)}
            />
          ))}
        </div>
        <FormField
          name="custom-wallet-hub"
          type="text"
          label={__('Custom hub address')}
          placeholder="hub.example.org:50001"
          value={customAddress}
          onChange={event => setCustomAddress(event.target.value)}
        />
        <Button button="link" label={__('Check custom hub')} disabled={saving || scanning || !customAddress.trim()} onClick={checkCustom} />
      </fieldset>
      <div aria-live="polite">
        {scanning && <p>{__('Checking hub response times…')}</p>}
        {saving && <p>{__('Starting your wallet…')}</p>}
        {!scanning && !servers.some(server => !server.error) && (
          <p>{__('No hubs responded. Try a custom address, check again, or continue with automatic selection.')}</p>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
      <div className="card__actions">
        <Button button="primary" label={__('Start syncing')} disabled={saving || scanning} onClick={next} />
        <Button button="link" label={__('Check again')} disabled={saving || scanning} onClick={scan} />
      </div>
      <p className="help">{__('You can change this later in Settings → Wallet Server.')}</p>
    </section>
  );
}
