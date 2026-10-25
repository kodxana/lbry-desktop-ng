import { connect } from 'react-redux';
import { makeSelectFileRenderModeForUri } from 'redux/selectors/content';
import { withDesktopRouter } from 'component/common/desktop-router';
import FileRenderDownload from './view';

const select = (state, props) => ({
  renderMode: makeSelectFileRenderModeForUri(props.uri)(state),
});

export default withDesktopRouter(connect(select)(FileRenderDownload));
