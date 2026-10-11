import * as MODALS from 'constants/modal_types';
import { connect } from 'react-redux';
import { selectDaemonVersionMatched, selectModal } from 'redux/selectors/app';
import { doCheckDaemonVersion, doOpenModal, doHideModal } from 'redux/actions/app';
import SplashScreen from './view';

const select = (state) => ({
  modal: selectModal(state),
  daemonVersionMatched: selectDaemonVersionMatched(state),
});

const perform = (dispatch) => ({
  checkDaemonVersion: () => dispatch(doCheckDaemonVersion()),
  notifyUnlockWallet: (shouldTryWithBlankPassword) =>
    dispatch(doOpenModal(MODALS.WALLET_UNLOCK, { shouldTryWithBlankPassword })),
  hideModal: () => dispatch(doHideModal()),
});

export default connect(select, perform)(SplashScreen);
