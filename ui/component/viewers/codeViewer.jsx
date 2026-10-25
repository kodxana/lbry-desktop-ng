// @flow
import * as React from 'react';
import { Compartment, EditorState, Transaction } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { languages } from '@codemirror/language-data';
import { editorHighlighting } from 'util/editor-theme';
import { openSnippetMenu, stopContextMenu } from 'util/context-menu';

type Props = { theme: string, value: ?string, contentType: string };

class CodeViewer extends React.PureComponent<Props> {
  parent: ?HTMLDivElement;
  codeMirror: ?EditorView;
  language: Compartment = new Compartment();
  theme: Compartment = new Compartment();
  languageRequest: number = 0;

  loadLanguage = (): void => {
    const request = ++this.languageRequest;
    const editor = this.codeMirror;
    if (!editor) return;
    const mime = this.props.contentType.split(';')[0].trim().toLowerCase();
    const description = languages.find(
      (language) =>
        language.alias.includes(mime) || language.extensions.includes(mime) || language.name.toLowerCase() === mime
    );
    // language-data records names/extensions; MIME aliases used by document claims are explicit here.
    const names: { [string]: string } = {
      'text/javascript': 'javascript',
      'application/javascript': 'javascript',
      'application/json': 'json',
      'text/typescript': 'typescript',
      'text/jsx': 'jsx',
      'text/css': 'css',
      'text/html': 'html',
      'text/xml': 'xml',
      'application/xml': 'xml',
      'text/x-go': 'go',
      'text/x-php': 'php',
      'application/x-httpd-php': 'php',
      'text/x-ruby': 'ruby',
      'text/x-csrc': 'c',
      'text/x-c++src': 'c++',
      'text/x-java': 'java',
      'text/x-csharp': 'c#',
      'text/x-sh': 'shell',
      'application/x-sh': 'shell',
      'text/x-python': 'python',
      'text/markdown': 'markdown',
      'text/x-markdown': 'markdown',
    };
    const language = description || languages.find((entry) => entry.name.toLowerCase() === names[mime]);
    editor.dispatch({ effects: this.language.reconfigure([]) });
    if (language)
      language
        .load()
        .then((support) => {
          if (this.codeMirror === editor && request === this.languageRequest) {
            editor.dispatch({ effects: this.language.reconfigure(support) });
          }
        })
        .catch(() => {
          /* A failed syntax chunk must still leave readable plain text. */
        });
  };

  componentDidMount(): void {
    if (!this.parent) return;
    this.codeMirror = new EditorView({
      parent: this.parent,
      doc: this.props.value || '',
      extensions: [
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.contentAttributes.of({ 'aria-label': __('Document text'), tabindex: '0' }),
        EditorView.lineWrapping,
        lineNumbers(),
        editorHighlighting,
        keymap.of(defaultKeymap),
        this.language.of([]),
        this.theme.of(EditorView.theme({}, { dark: this.props.theme === 'dark' })),
        EditorView.domEventHandlers({
          contextmenu(event, view) {
            openSnippetMenu(view, event);
          },
        }),
      ],
    });
    this.loadLanguage();
  }

  componentDidUpdate(previous: Props): void {
    const editor = this.codeMirror;
    if (!editor) return;
    if (previous.value !== this.props.value)
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: this.props.value || '' },
        annotations: Transaction.addToHistory.of(false),
      });
    if (previous.theme !== this.props.theme)
      editor.dispatch({
        effects: this.theme.reconfigure(EditorView.theme({}, { dark: this.props.theme === 'dark' })),
      });
    if (previous.contentType !== this.props.contentType) this.loadLanguage();
  }

  componentWillUnmount(): void {
    this.languageRequest++;
    this.codeMirror?.destroy();
    this.codeMirror = null;
  }

  render(): React.Node {
    return (
      <div
        className={`file-render__content code-viewer cm-s-${this.props.theme === 'dark' ? 'monokai' : 'ttcn'}`}
        onContextMenu={stopContextMenu}
        ref={(parent) => {
          this.parent = parent;
        }}
      />
    );
  }
}
export default CodeViewer;
