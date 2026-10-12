import { connect } from 'react-redux';
import { selectTotalBalance, selectWalletSyncStatus } from 'redux/selectors/wallet';
import { doOpenModal } from 'redux/actions/app';
import Wallet from './view';

const select = (state) => ({
  totalBalance: selectTotalBalance(state),
  syncStatus: selectWalletSyncStatus(state),
});

export default connect(select, {
  doOpenModal,
})(Wallet);
