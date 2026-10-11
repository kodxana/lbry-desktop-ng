// @flow

// Header progress is only one part of startup, never an overall completion estimate.
export function startupProgress(status: ?StatusResponse, locked: boolean = false) {
  const wallet = status && status.wallet;
  const connected = Boolean(wallet && wallet.available_servers);
  const value = wallet && wallet.headers_synchronization_progress;
  const percent =
    connected && typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
  const ready = Boolean(status && (status.is_running || (status.startup_status && status.startup_status.wallet)));
  return {
    step: !connected ? 0 : locked ? 1 : ready ? 2 : 1,
    percent,
    hub: connected && wallet ? wallet.connected : null,
    title: locked
      ? __('Unlock your wallet')
      : !connected
      ? __('Connecting to a hub')
      : ready
      ? __('Opening your library')
      : __('Syncing your wallet'),
    detail: locked
      ? __('Enter your password in the wallet dialog to continue.')
      : !connected
      ? __('Finding a connection to the LBRY network. You can choose another hub at any time.')
      : ready
      ? __('Your wallet is ready. Checking the connection before opening the app.')
      : __('Downloading wallet headers and checking your history. First-time setup can take longer.'),
  };
}
