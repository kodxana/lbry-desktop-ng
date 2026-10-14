// @flow

export function walletSyncProgress(status: ?StatusResponse) {
  const wallet = status && status.wallet;
  const history = wallet && wallet.history_sync;
  const supported = Boolean(history && ['idle', 'syncing', 'incomplete', 'complete'].includes(history.state));
  const connected = Boolean(wallet && wallet.available_servers && history && history.connected === true);
  const complete = Boolean(
    supported &&
      connected &&
      history &&
      history.state === 'complete' &&
      wallet &&
      wallet.headers_synchronization_progress === 100
  );
  const completed = history && history.entries_completed;
  const total = history && history.entries_total;
  const countsValid =
    Number.isSafeInteger(completed) && Number.isSafeInteger(total) && completed >= 0 && total > 0 && completed <= total;
  return {
    supported,
    pending: !complete,
    title: !supported
      ? __('Wallet sync status unavailable')
      : !connected
      ? __('Waiting for a wallet hub')
      : history && history.state === 'incomplete'
      ? __('Wallet history sync incomplete')
      : history && history.state === 'syncing'
      ? __('Syncing transaction history')
      : complete
      ? __('Wallet history is up to date')
      : __('Checking wallet sync'),
    detail: complete ? null : __('Your balance may change while wallet history is updating.'),
    count:
      supported && countsValid && history && history.state === 'syncing'
        ? __('%completed% of %total% known history entries saved. More may be discovered.', { completed, total })
        : null,
  };
}

export async function readWalletSnapshot(sdk: any) {
  // Read status before the balance so a completed status cannot accompany a
  // balance read from an earlier, unfinished batch. Missing status stays unknown.
  const status = await sdk.status().catch(() => null);
  const balance = await sdk.wallet_balance();
  return { status, balance };
}
