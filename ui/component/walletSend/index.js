import { connect } from 'react-redux';
import { selectBalance } from 'redux/selectors/wallet';
import { makeSelectClaimForUri } from 'redux/selectors/claims';
import { doOpenModal } from 'redux/actions/app';
import WalletSend from './view';
import { withDesktopRouter } from 'component/common/desktop-router';
import { selectToast } from 'redux/selectors/notifications';

const perform = (dispatch) => ({
  openModal: (modal, props) => dispatch(doOpenModal(modal, props)),
});

const select = (state, props) => ({
  balance: selectBalance(state),
  contentClaim: makeSelectClaimForUri(props.contentUri)(state),
  snack: selectToast(state),
});

export default withDesktopRouter(connect(select, perform)(WalletSend));
