// @flow
import React from 'react';
import { connect } from 'react-redux';
import Button from 'component/button';
import Nag from 'component/common/nag';
import { doAuthenticate } from 'redux/actions/user';
import { doSyncLoop } from 'redux/actions/sync';

type Props = {
  unavailable: boolean,
  pending: boolean,
  retry: () => Promise<void>,
};
type AccountState = {
  user: { accountServiceUnavailable?: boolean, authenticationIsPending?: boolean, ... },
  sync: { serviceUnavailable?: boolean, getSyncIsPending?: boolean, setSyncIsPending?: boolean, ... },
  ...
};

export function AccountServiceStatus({ unavailable, pending, retry }: Props): React.Node {
  if (!unavailable) return null;
  return (
    <div role="status">
      <Nag
        inline
        relative
        message={
          <>
            {__(
              'Account services are unavailable. You can keep using your local wallet and library. Cloud backups may be out of date.'
            )}{' '}
            <Button button="link" disabled={pending} onClick={retry} label={pending ? __('Retrying…') : __('Retry')} />
          </>
        }
      />
    </div>
  );
}

const ConnectedAccountServiceStatus: React.ComponentType<{}> = connect(
  (state: AccountState) => ({
    unavailable: Boolean(state.user.accountServiceUnavailable || state.sync.serviceUnavailable),
    pending: Boolean(state.user.authenticationIsPending || state.sync.getSyncIsPending || state.sync.setSyncIsPending),
  }),
  (dispatch: Dispatch) => ({
    retry: async () => {
      // Retrying account access must not opt the user into install tracking.
      await dispatch(doAuthenticate(undefined, null, null, false));
      await dispatch(doSyncLoop(true));
    },
  })
)(AccountServiceStatus);

export default ConnectedAccountServiceStatus;
