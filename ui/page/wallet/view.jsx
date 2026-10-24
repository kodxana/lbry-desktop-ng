// @flow
import React from 'react';
import { useDesktopHistory } from 'component/common/desktop-router';
import TxoList from 'component/txoList';
import Page from 'component/page';
import WalletBalance from 'component/walletBalance';
import Spinner from 'component/spinner';
import YrblWalletEmpty from 'component/yrblWalletEmpty';
import WalletSyncNotice from 'component/walletSyncNotice/view';
import { walletSyncProgress } from 'util/wallet-sync';

type Props = {
  history: { action: string, push: (string) => void, replace: (string) => void },
  location: { search: string, pathname: string },
  totalBalance: ?number,
  syncStatus: ?StatusResponse,
};

const WalletPage = (props: Props): React.Node => {
  const {
    location: { search },
  } = useDesktopHistory();

  const { totalBalance, syncStatus } = props;
  const showIntro = totalBalance === 0 && !walletSyncProgress(syncStatus).pending;
  const loading = totalBalance === undefined;

  return (
    <Page>
      {loading && (
        <div className="main--empty">
          <WalletSyncNotice status={syncStatus} />
          <Spinner delayed />
        </div>
      )}
      {!loading && (
        <>
          {showIntro ? (
            <YrblWalletEmpty includeWalletLink />
          ) : (
            <div className="card-stack">
              <WalletBalance />
              <TxoList search={search} />
            </div>
          )}
        </>
      )}
    </Page>
  );
};

export default WalletPage;
