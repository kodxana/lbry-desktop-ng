// @flow
import 'font-awesome/css/font-awesome.min.css';
import * as React from 'react';
import { Compartment, EditorState, Transaction } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentMore, indentLess } from '@codemirror/commands';
import { markdown, markdownKeymap, markdownLanguage } from '@codemirror/lang-markdown';
import { openEditorMenu } from 'util/context-menu';
import { formatMarkdown, editingLimits } from 'util/markdown-commands';
import { editorHighlighting } from 'util/editor-theme';
import editorSpellcheck from 'util/editor-spellcheck';
import MarkdownPreview from 'component/common/markdown-preview';
import Button from 'component/button';
import type { MarkdownEditorProps } from 'types/markdown-editor';
import type { MarkdownAction } from 'util/markdown-commands';

const actions: Array<{ name: MarkdownAction, label: string, icon: string }> = [
  { name: 'bold', label: 'Bold', icon: 'bold' },
  { name: 'italic', label: 'Italic', icon: 'italic' },
  { name: 'quote', label: 'Quote', icon: 'quote-left' },
  { name: 'unordered-list', label: 'Bulleted list', icon: 'list-ul' },
  { name: 'ordered-list', label: 'Numbered list', icon: 'list-ol' },
  { name: 'link', label: 'Create link', icon: 'link' },
];

const headings: Array<MarkdownAction> = ['heading-1', 'heading-2', 'heading-3', 'heading-4', 'heading-5', 'heading-6'];

export default function MarkdownEditor(props: MarkdownEditorProps): React.Node {
  const current = React.useRef(props);
  current.current = props;
  const parent = React.useRef<?HTMLDivElement>(null);
  const previewButton = React.useRef<?HTMLButtonElement>(null);
  const editor = React.useRef<?EditorView>(null);
  const configuration = React.useRef(new Compartment());
  const [preview, setPreview] = React.useState(false);
  const [sideBySide, setSideBySide] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const wasPreview = React.useRef(false);
  const [status, setStatus] = React.useState(() => ({
    lines: String(props.value ?? '').split('\n').length,
    words: (String(props.value ?? '').match(/\S+/g) || []).length,
    line: 1,
    column: 1,
  }));
  const { name, label, value, disabled, placeholder: hint } = props;

  React.useEffect(() => {
    if (!parent.current) return;
    const view = new EditorView({
      parent: parent.current,
      doc: String(current.current.value ?? ''),
      extensions: [
        history(),
        markdown({ base: markdownLanguage }),
        editorHighlighting,
        EditorView.lineWrapping,
        editorSpellcheck,
        editingLimits(() => current.current.textAreaMaxLength),
        configuration.current.of([]),
        keymap.of([
          { key: 'Mod-b', run: (view: EditorView) => formatMarkdown(view, 'bold') },
          { key: 'Mod-i', run: (view: EditorView) => formatMarkdown(view, 'italic') },
          { key: 'Mod-k', run: (view: EditorView) => formatMarkdown(view, 'link') },
          { key: "Mod-'", run: (view: EditorView) => formatMarkdown(view, 'quote') },
          { key: 'Mod-l', run: (view: EditorView) => formatMarkdown(view, 'unordered-list') },
          { key: 'Mod-Alt-l', run: (view: EditorView) => formatMarkdown(view, 'ordered-list') },
          { key: 'Mod-Shift-l', run: (view: EditorView) => formatMarkdown(view, 'check-list') },
          { key: 'Mod-Alt-c', run: (view: EditorView) => formatMarkdown(view, 'code') },
          { key: 'Mod-Alt-i', run: (view: EditorView) => formatMarkdown(view, 'image') },
          { key: 'Mod-e', run: (view: EditorView) => formatMarkdown(view, 'clean') },
          { key: 'Mod-h', run: (view: EditorView) => formatMarkdown(view, 'heading-smaller') },
          { key: 'Mod-Shift-h', run: (view: EditorView) => formatMarkdown(view, 'heading-bigger') },
          ...headings.map((action, i) => ({
            key: `Mod-Alt-${i + 1}`,
            run: (view: EditorView) => formatMarkdown(view, action),
          })),
          {
            key: 'Mod-p',
            run: () => {
              setPreview((visible) => !visible);
              return true;
            },
          },
          ...[
            { key: 'Tab', indent: indentMore },
            { key: 'Shift-Tab', indent: indentLess },
          ].map(({ key, indent }) => ({
            key,
            run: (view: EditorView) =>
              /^\s*(?:[-+*]|\d+\.)\s/.test(view.state.doc.lineAt(view.state.selection.main.head).text) && indent(view),
          })),
          ...markdownKeymap,
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.domEventHandlers({
          contextmenu(event, view) {
            openEditorMenu(view, event);
          },
        }),
        EditorView.updateListener.of((update) => {
          if (
            update.docChanged &&
            !update.transactions.every((transaction) => transaction.annotation(Transaction.remote))
          ) {
            current.current.onChange?.(update.state.doc.toString());
          }
          if (update.docChanged || update.selectionSet) {
            const { doc, selection } = update.state;
            const line = doc.lineAt(selection.main.head);
            setStatus((previous) => ({
              lines: doc.lines,
              words: update.docChanged ? (doc.toString().match(/\S+/g) || []).length : previous.words,
              line: line.number,
              column: selection.main.head - line.from + 1,
            }));
          }
        }),
      ],
    });
    editor.current = view;
    if (current.current.autoFocus) view.focus();
    return () => {
      editor.current = null;
      view.destroy();
    };
  }, []);

  React.useEffect(() => {
    const view = editor.current;
    if (!view) return;
    view.dispatch({
      effects: configuration.current.reconfigure([
        EditorState.readOnly.of(!!disabled || preview),
        EditorView.editable.of(!disabled && !preview),
        EditorView.contentAttributes.of({
          id: name,
          'aria-label': label || name,
          'aria-disabled': String(!!disabled),
          spellcheck: 'false',
        }),
        placeholder(hint || ''),
      ]),
    });
    if (preview) previewButton.current?.focus();
    else if (wasPreview.current) view.focus();
    wasPreview.current = preview;
  }, [disabled, preview, hint, label, name]);

  React.useEffect(() => {
    const view = editor.current;
    const text = String(value ?? '');
    if (view && view.state.doc.toString() !== text) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        annotations: [Transaction.remote.of(true), Transaction.addToHistory.of(false)],
        filter: false,
      });
    }
  }, [value]);

  return (
    <div
      className={`markdown-editor${fullscreen ? ' markdown-editor--fullscreen' : ''}`}
      onKeyDown={(event) => {
        if (event.key === 'F11') {
          event.preventDefault();
          event.stopPropagation();
          setFullscreen(!fullscreen);
        } else if (event.key === 'F9') {
          event.preventDefault();
          setSideBySide(!sideBySide);
          setPreview(false);
        } else if (event.key === 'Escape' && fullscreen) {
          event.preventDefault();
          setFullscreen(false);
        } else if (preview && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
          event.preventDefault();
          setPreview(false);
        }
      }}
    >
      <div className="editor-toolbar" role="toolbar" aria-label={__('Markdown formatting')}>
        {actions.map(({ name, label, icon }) => (
          <button
            key={name}
            type="button"
            className={name}
            title={__(label)}
            aria-label={__(label)}
            disabled={disabled || preview}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (editor.current) formatMarkdown(editor.current, name);
            }}
          >
            <i className={`fa fa-${icon}`} aria-hidden="true" />
          </button>
        ))}
        <button
          type="button"
          ref={previewButton}
          className={`preview${preview ? ' active' : ''}`}
          title={__('Toggle preview')}
          aria-label={__('Toggle preview')}
          aria-pressed={preview}
          disabled={disabled}
          onClick={() => {
            setPreview(!preview);
          }}
        >
          <i className="fa fa-eye" aria-hidden="true" />
        </button>
        <Button
          button="link"
          className="guide"
          href="https://www.markdownguide.org/basic-syntax/"
          title={__('Markdown Guide')}
          aria-label={__('Markdown Guide')}
          disabled={disabled}
          label={<i className="fa fa-question-circle" aria-hidden="true" />}
        />
      </div>
      <div className={sideBySide ? 'markdown-editor__split' : undefined}>
        <div ref={parent} hidden={preview} />
        {(preview || sideBySide) && (
          <div className="editor-preview-active">
            <MarkdownPreview content={String(value ?? '')} noDataStore />
          </div>
        )}
      </div>
      <div className="editor-statusbar" aria-live="off">
        <span title={__('Lines')}>{status.lines}</span>
        <span title={__('Words')}>{status.words}</span>
        <span title={__('Cursor position')}>
          {status.line}:{status.column}
        </span>
      </div>
    </div>
  );
}
