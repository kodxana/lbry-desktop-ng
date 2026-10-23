import { connect } from 'react-redux';
import ClaimCollectionAdd from './view';
import { withDesktopRouter } from 'component/common/desktop-router';
import {
  selectBuiltinCollections,
  selectMyPublishedCollections,
  selectMyUnpublishedCollections,
} from 'redux/selectors/collections';
import { makeSelectClaimForUri } from 'redux/selectors/claims';
import { doLocalCollectionCreate } from 'redux/actions/collections';

const select = (state, props) => ({
  claim: makeSelectClaimForUri(props.uri)(state),
  builtin: selectBuiltinCollections(state),
  published: selectMyPublishedCollections(state),
  unpublished: selectMyUnpublishedCollections(state),
});

const perform = (dispatch) => ({
  addCollection: (name, items, type) => dispatch(doLocalCollectionCreate(name, items, type)),
});

export default withDesktopRouter(connect(select, perform)(ClaimCollectionAdd));
