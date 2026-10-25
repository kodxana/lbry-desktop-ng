import { connect } from 'react-redux';
import { doHideModal } from 'redux/actions/app';
import { selectAccessToken, selectUser } from 'redux/selectors/user';
import { withDesktopRouter } from 'component/common/desktop-router';

import ModalFirstSubscription from './view';

const select = (state) => ({
  accessToken: selectAccessToken(state),
  user: selectUser(state),
});

const perform = (dispatch) => () => ({
  closeModal: () => dispatch(doHideModal()),
});

export default withDesktopRouter(connect(select, perform)(ModalFirstSubscription));
