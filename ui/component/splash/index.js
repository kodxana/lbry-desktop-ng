import * as MODALS from 'constants/modal_types';
import { connect } from 'react-redux';
import { selectDaemonVersionMatched, selectModal, selectSplashAnimationEnabled } from 'redux/selectors/app';
import { doCheckDaemonVersion, doOpenModal, doHideModal, doToggleSplashAnimation } from 'redux/actions/app';
import SplashScreen from './view';

const select = (state) => ({
  modal: selectModal(state),
  daemonVersionMatched: selectDaemonVersionMatched(state),
  animationHidden: selectSplashAnimationEnabled(state),
});

const perform = (dispatch) => ({
  checkDaemonVersion: () => dispatch(doCheckDaemonVersion()),
  notifyUnlockWallet: (shouldTryWithBlankPassword) =>
    dispatch(doOpenModal(MODALS.WALLET_UNLOCK, { shouldTryWithBlankPassword })),
  hideModal: () => dispatch(doHideModal()),
  toggleSplashAnimation: () => dispatch(doToggleSplashAnimation()),
});

export default connect(select, perform)(SplashScreen);
