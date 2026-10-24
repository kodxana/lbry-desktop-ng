// @flow
import * as React from 'react';
import { stopContextMenu } from 'util/context-menu';
import IframeReact from 'component/IframeReact';
import desktop from 'util/desktop';
const pathToFileURL = (value: string): URL => new URL(desktop.fileUrl(value));

type Props = {
  source: string,
};

class PdfViewer extends React.PureComponent<Props> {
  render(): React.Node {
    const { source } = this.props;
    const src = pathToFileURL(source).href;
    return (
      <div className="file-viewer file-viewer--document" onContextMenu={stopContextMenu}>
        <div className="file-viewer file-viewer--iframe">
          <IframeReact title={__('File preview')} src={src} />
        </div>
      </div>
    );
  }
}

export default PdfViewer;
