// @flow

import React from 'react';
import mammoth from 'mammoth';
import desktop from 'util/desktop';
import sanitizeDocumentHtml from 'util/document-html';
import LoadingScreen from 'component/common/loading-screen';

type Props = {
  source: string,
};

type State = {
  error: boolean,
  loading: boolean,
  content: ?string,
};

class DocxViewer extends React.PureComponent<Props, State> {
  loadId: number = 0;
  constructor(props: Props) {
    super(props);
    this.state = {
      error: false,
      content: null,
      loading: true,
    };
  }
  componentDidMount() {
    this.loadSource();
  }

  componentDidUpdate(previous: Props) {
    if (previous.source !== this.props.source) this.loadSource();
  }

  loadSource(): void {
    const request = ++this.loadId;
    this.setState({ content: null, error: false, loading: true });
    const { source } = this.props;

    // Overwrite element and styles
    const options = {
      externalFileAccess: false,
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Section Title'] => h1:fresh",
        "p[style-name='Subsection Title'] => h2:fresh",
        "p[style-name='Aside Heading'] => div.aside > h2:fresh",
        "p[style-name='Aside Text'] => div.aside > p:fresh",
      ],
    };

    // Parse docx to html
    desktop
      .readDocument(source)
      .then((bytes) => {
        const arrayBuffer = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(arrayBuffer).set(bytes);
        return mammoth.convertToHtml({ arrayBuffer }, options);
      })
      .then((result) => {
        if (request === this.loadId) this.setState({ content: sanitizeDocumentHtml(result.value), loading: false });
      })
      .catch(() => {
        if (request === this.loadId) this.setState({ error: true, loading: false });
      });
  }

  componentWillUnmount() {
    this.loadId++;
  }

  render(): React.Node {
    const { content, error, loading } = this.state;
    const loadingMessage = __('Rendering document.');
    const errorMessage = __("Sorry, looks like we can't load the document.");

    return (
      <div className="file-viewer file-viewer--document">
        {loading && <LoadingScreen status={loadingMessage} spinner />}
        {error && <LoadingScreen status={errorMessage} spinner={false} />}
        {content && <div className="file-render__content" dangerouslySetInnerHTML={{ __html: content }} />}
      </div>
    );
  }
}

export default DocxViewer;
