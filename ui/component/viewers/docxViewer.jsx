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
  constructor(props: Props) {
    super(props);
    this.state = {
      error: false,
      content: null,
      loading: true,
    };
  }
  componentDidMount() {
    this.mounted = true;
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
      .then((bytes) =>
        mammoth.convertToHtml(
          { arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) },
          options
        )
      )
      .then((result) => {
        if (this.mounted) this.setState({ content: sanitizeDocumentHtml(result.value), loading: false });
      })
      .catch(() => {
        if (this.mounted) this.setState({ error: true, loading: false });
      });
  }

  componentWillUnmount() {
    this.mounted = false;
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
