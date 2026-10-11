import { connect } from 'react-redux';
import HubSetup from './view';
import * as ACTIONS from 'constants/action_types';
import { doFetchDaemonSettings, doGetDaemonStatus, doSaveCustomWalletServers } from 'redux/actions/settings';

const perform = dispatch => ({
  onSelected: server => {
    dispatch(doSaveCustomWalletServers(server ? [[server.host, String(server.port)]] : []));
    dispatch({
      type: ACTIONS.SHARED_PREFERENCE_SET,
      data: { key: 'lbryum_servers', value: server ? [[server.host, server.port]] : null },
    });
    dispatch(doFetchDaemonSettings());
    dispatch(doGetDaemonStatus());
  },
});

export default connect(null, perform)(HubSetup);
