import * as PAGES from 'constants/pages';
import { connect } from 'react-redux';
import { makeSelectClaimForUri, makeSelectClaimIsPending } from 'redux/selectors/claims';
import { doClearPublish, doUpdatePublishForm } from 'redux/actions/publish';
import { push } from 'redux-first-history';
import ClaimPreviewSubtitle from './view';

const select = (state, props) => ({
  claim: makeSelectClaimForUri(props.uri)(state),
  pending: makeSelectClaimIsPending(props.uri)(state),
});

const perform = (dispatch) => ({
  beginPublish: (name) => {
    dispatch(doClearPublish());
    dispatch(doUpdatePublishForm({ name }));
    dispatch(push(`/$/${PAGES.UPLOAD}`));
  },
});

export default connect(select, perform)(ClaimPreviewSubtitle);
