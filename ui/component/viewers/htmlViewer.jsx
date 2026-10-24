// @flow
import * as React from 'react';
import { stopContextMenu } from 'util/context-menu';
import desktop from 'util/desktop';
const pathToFileURL = (value: string): URL => new URL(desktop.fileUrl(value));

type Props = {
  source: string,
};

type State = {
  loading: boolean,
};

class HtmlViewer extends React.PureComponent<Props, State> {
  iframe: React.ElementRef<any>;
  constructor(props: Props) {
    super(props);
    this.state = { loading: true };
    this.iframe = React.createRef();
  }

  componentDidMount() {
    this.iframe.current.onload = () => {
      this.setState({ loading: false });
    };
  }

  render(): React.Node {
    const { source } = this.props;
    const { loading } = this.state;
    return (
      <div className="file-viewer file-viewer--html file-viewer--iframe" onContextMenu={stopContextMenu}>
        {loading && <div className="placeholder--text-document" />}
        <iframe
          ref={this.iframe}
          hidden={loading}
          sandbox=""
          title={__('File preview')}
          src={pathToFileURL(source).href}
        />
      </div>
    );
  }
}

export default HtmlViewer;
