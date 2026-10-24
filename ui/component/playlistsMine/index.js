import { connect } from 'react-redux';
import { withDesktopRouter } from 'component/common/desktop-router';
import {
  selectMyPublishedPlaylistCollections,
  selectMyUnpublishedCollections, // should probably distinguish types
  // selectSavedCollections,
} from 'redux/selectors/collections';
import { selectFetchingMyCollections } from 'redux/selectors/claims';
import PlaylistsMine from './view';

const select = (state) => {
  return {
    publishedCollections: selectMyPublishedPlaylistCollections(state),
    unpublishedCollections: selectMyUnpublishedCollections(state),
    // savedCollections: selectSavedCollections(state),
    fetchingCollections: selectFetchingMyCollections(state),
  };
};

export default withDesktopRouter(connect(select)(PlaylistsMine));
