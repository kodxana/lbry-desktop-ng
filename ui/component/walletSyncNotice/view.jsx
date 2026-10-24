// @flow
import React from 'react';
import { walletSyncProgress } from 'util/wallet-sync';

type Props = { status: ?StatusResponse };

export default function WalletSyncNotice({ status }: Props): React.Node {
  const progress = walletSyncProgress(status);
  if (!progress.pending) return null;
  return (
    <div className="help" role="status">
      <strong>{progress.title}</strong>
      <p>{progress.detail}</p>
      {progress.count && <p>{progress.count}</p>}
    </div>
  );
}
