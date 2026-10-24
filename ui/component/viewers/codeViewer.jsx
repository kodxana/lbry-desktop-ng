// @flow

import * as React from 'react';
import { openSnippetMenu, stopContextMenu } from 'util/context-menu';

// Addons
import 'codemirror/addon/selection/mark-selection';

// Syntax mode
import 'codemirror/mode/go/go';
import 'codemirror/mode/jsx/jsx';
import 'codemirror/mode/css/css';
import 'codemirror/mode/xml/xml';
import 'codemirror/mode/php/php';
import 'codemirror/mode/ruby/ruby';
import 'codemirror/mode/clike/clike';
import 'codemirror/mode/shell/shell';
import 'codemirror/mode/python/python';
import 'codemirror/mode/markdown/markdown';
import 'codemirror/mode/javascript/javascript';

type Props = {
  theme: string,
  value: ?string,
  contentType: string,
};

type CodeEditor = {
  setOption: (string, string | boolean) => void,
  setValue: (string) => void,
  on: (string, (...Array<unknown>) => void) => void,
  toTextArea: () => void,
};

class CodeViewer extends React.PureComponent<Props> {
  mounted: boolean = false;
  constructor(props: Props) {
    super(props);
    this.codeMirror = null;
  }

  componentDidUpdate(prevProps: Props): void {
    const editor = this.codeMirror;
    if (!editor) return;
    if (prevProps.theme !== this.props.theme)
      editor.setOption('theme', this.props.theme === 'dark' ? 'monokai' : 'ttcn');
    if (prevProps.contentType !== this.props.contentType) editor.setOption('mode', this.props.contentType);
    if (prevProps.value !== this.props.value) editor.setValue(this.props.value || '');
  }

  componentDidMount() {
    this.mounted = true;

    // Init CodeMirror
    import(
      /* webpackChunkName: "codemirror" */
      'codemirror/lib/codemirror'
    ).then((CodeMirror) => {
      const textarea = this.textarea;
      if (!this.mounted || !textarea) return;
      const { theme, contentType, value } = this.props;
      const editor: CodeEditor = CodeMirror.fromTextArea(textarea, {
        // Auto detect syntax with file contentType
        mode: contentType,
        // Adaptive theme
        theme: theme === 'dark' ? 'monokai' : 'ttcn',
        // Hide the cursor
        readOnly: true,
        // Styled text selection
        styleSelectedText: true,
        // Additional config opts
        dragDrop: false,
        lineNumbers: true,
        lineWrapping: true,
      });
      // Add events
      editor.setValue(value || '');
      editor.on('contextmenu', openSnippetMenu);
      this.codeMirror = editor;
    });
  }

  componentWillUnmount(): void {
    this.mounted = false;
    if (this.codeMirror) this.codeMirror.toTextArea();
    this.codeMirror = null;
  }

  textarea: ?HTMLTextAreaElement;
  codeMirror: ?CodeEditor;

  render(): React.Node {
    const { value } = this.props;
    return (
      <div className="file-render__content" onContextMenu={stopContextMenu}>
        <textarea
          ref={(textarea) => {
            this.textarea = textarea;
          }}
          disabled
          value={value}
        />
      </div>
    );
  }
}

export default CodeViewer;
