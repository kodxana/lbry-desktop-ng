import { connect } from 'react-redux';
import { doWalletStatus, doWalletEncrypt } from 'redux/actions/wallet';
import { doHideModal } from 'redux/actions/app';
import ModalWalletEncrypt from './view';

const perform = (dispatch) => ({
  closeModal: () => dispatch(doHideModal()),
  encryptWallet: (password) => dispatch(doWalletEncrypt(password)),
  updateWalletStatus: () => dispatch(doWalletStatus()),
});

export default connect(null, perform)(ModalWalletEncrypt);
