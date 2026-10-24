// @flow

import React from 'react';
import LoadingScreen from 'component/common/loading-screen';
import MarkdownPreview from 'component/common/markdown-preview';
import CodeViewer from 'component/viewers/codeViewer';
import * as RENDER_MODES from 'constants/file_render_modes';

type Props = {
  theme: string,
  renderMode: string,
  source: {
    file: () => Promise<Uint8Array>,
    contentType: string,
  },
};

type State = {
  error: boolean,
  loading: boolean,
  content: ?string,
};

class DocumentViewer extends React.PureComponent<Props, State> {
  loadId: number = 0;
  constructor(props: Props) {
    super(props);
    this.state = {
      error: false,
      loading: true,
      content: null,
    };
  }

  componentDidMount() {
    this.loadSource();
  }

  componentDidUpdate(previous: Props) {
    if (previous.source.file !== this.props.source.file) this.loadSource();
  }

  async loadSource(): Promise<void> {
    const request = ++this.loadId;
    const { file } = this.props.source;
    this.setState({ content: null, error: false, loading: true });
    try {
      const bytes = await file();
      if (request === this.loadId) this.setState({ content: new TextDecoder().decode(bytes), loading: false });
    } catch (_) {
      if (request === this.loadId) this.setState({ error: true, loading: false });
    }
  }

  componentWillUnmount() {
    this.loadId++;
  }

  renderDocument(): React.Node {
    const { content } = this.state;
    const { source, theme, renderMode } = this.props;
    const { contentType } = source;

    return renderMode === RENDER_MODES.MARKDOWN ? (
      <MarkdownPreview content={content} isMarkdownPost />
    ) : (
      <CodeViewer value={content} contentType={contentType} theme={theme} />
    );
  }

  render(): React.Node {
    const { error, content } = this.state;
    const isReady = content !== null && !error;
    const errorMessage = __("Sorry, looks like we can't load the document.");

    return (
      <div className="file-viewer file-viewer--document">
        {error && <LoadingScreen status={errorMessage} spinner={!error} />}
        {isReady && this.renderDocument()}
      </div>
    );
  }
}

export default DocumentViewer;
