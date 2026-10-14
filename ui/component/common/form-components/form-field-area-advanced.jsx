// @flow
import 'easymde/dist/easymde.min.css';
import 'font-awesome/css/font-awesome.min.css';
import { FF_MAX_CHARS_DEFAULT } from 'constants/form-field';
import { openEditorMenu, stopContextMenu } from 'util/context-menu';
import * as ICONS from 'constants/icons';
import Button from 'component/button';
import MarkdownPreview from 'component/common/markdown-preview';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import SimpleMDE from 'react-simplemde-editor';
import editorSpellcheck from 'util/editor-spellcheck';
import TextareaWithSuggestions from 'component/textareaWithSuggestions';
import type { ElementRef, Node } from 'react';

type Props = {
  autoFocus?: boolean,
  blockWrap: boolean,
  charCount?: number,
  children?: React$Node,
  disabled?: boolean,
  helper?: string | React$Node,
  hideSuggestions?: boolean,
  isLivestream?: boolean,
  label?: string | Node,
  labelOnLeft: boolean,
  name: string,
  noEmojis?: boolean,
  placeholder?: string | number,
  quickActionLabel?: string,
  textAreaMaxLength?: number,
  type?: string,
  value?: string | number,
  onChange?: (any) => any,
  openEmoteMenu?: () => void,
  quickActionHandler?: (any) => any,
  render?: () => React$Node,
  header?: React$Node,
};

export class FormFieldAreaAdvanced extends React.PureComponent<Props> {
  static defaultProps = { labelOnLeft: false, blockWrap: true };

  input: { current: ElementRef<any> };
  editor: any;
  linkSelectionTimer: any;

  // v5 recreates the editor whenever options change, losing focus and undo history.
  markdownOptions = {
    autofocus: this.props.autoFocus,
    autoDownloadFontAwesome: false,
    spellChecker: editorSpellcheck,
    hideIcons: ['heading', 'image', 'fullscreen', 'side-by-side'],
    previewRender(plainText) {
      return ReactDOMServer.renderToString(<MarkdownPreview content={plainText} noDataStore />);
    },
  };

  handleBeforeChange = (instance, changes) => {
    // Restored drafts and externally loaded posts must keep their original contents.
    if (changes.origin === 'setValue') return;
    if (this.props.disabled) {
      changes.cancel();
      return;
    }
    const limit = this.props.textAreaMaxLength;
    if (limit && changes.update) {
      const text = changes.text.join('\n');
      const replacedLength = instance.indexFromPos(changes.to) - instance.indexFromPos(changes.from);
      if (text.length <= replacedLength) return;
      const available = Math.max(0, limit - instance.getValue().length + replacedLength);
      if (text.length > available) {
        changes.update(changes.from, changes.to, text.slice(0, available).split('\n'));
      }
    }
  };

  handleEditorChanges = (instance, changes) => {
    clearTimeout(this.linkSelectionTimer);
    const last = changes[changes.length - 1];
    if (!last || last.origin !== '+input') return;
    const text = last.text[last.text.length - 1];
    if (!text.endsWith('(https://)') || text === '[](https://)') return;
    const line = last.from.line + last.text.length - 1;
    const base = last.text.length > 1 ? 0 : last.from.ch;
    // EasyMDE's toolbar sets its selection after the change event.
    this.linkSelectionTimer = setTimeout(() => {
      if (this.editor && this.editor.codemirror === instance && instance.getWrapperElement().isConnected) {
        instance.setSelection(
          { line, ch: base + text.lastIndexOf('(') + 1 },
          { line, ch: base + text.lastIndexOf(')') }
        );
      }
    }, 25);
  };

  editorEvents = {
    contextmenu: openEditorMenu,
    beforeChange: this.handleBeforeChange,
    changes: this.handleEditorChanges,
  };

  syncEditorProps = () => {
    if (!this.editor) return;
    this.editor.codemirror.setOption('readOnly', !!this.props.disabled);
    this.editor.codemirror.setOption('placeholder', this.props.placeholder || '');
    this.editor.codemirror
      .getInputField()
      .setAttribute('aria-label', typeof this.props.label === 'string' ? this.props.label : this.props.name);
    this.editor.gui.toolbar.querySelectorAll('button').forEach((button) => {
      button.disabled = !!this.props.disabled;
    });
  };

  getEditorInstance = (editor) => {
    this.editor = editor;
    this.syncEditorProps();
  };

  constructor(props: Props) {
    super(props);
    this.input = React.createRef();
  }

  componentDidMount() {
    const { autoFocus } = this.props;
    const input = this.input.current;

    if (input && autoFocus) input.focus();
  }

  componentDidUpdate() {
    if (this.props.type === 'markdown') {
      this.syncEditorProps();
    } else {
      this.editor = null;
      clearTimeout(this.linkSelectionTimer);
    }
  }

  componentWillUnmount() {
    this.editor = null;
    clearTimeout(this.linkSelectionTimer);
  }

  render() {
    const {
      autoFocus,
      blockWrap,
      charCount,
      children,
      helper,
      hideSuggestions,
      isLivestream,
      label,
      header,
      labelOnLeft,
      name,
      noEmojis,
      quickActionLabel,
      textAreaMaxLength,
      type,
      openEmoteMenu,
      quickActionHandler,
      render,
      ...inputProps
    } = this.props;

    // Ideally, the character count should (and can) be appended to the
    // SimpleMDE's "options::status" bar. However, I couldn't figure out how
    // to pass the current value to it's callback, nor query the current
    // text length from the callback. So, we'll use our own widget.
    const hasCharCount = charCount !== undefined && charCount >= 0;
    const countInfo = hasCharCount && textAreaMaxLength !== undefined && (
      <span className="comment__char-count-mde">{`${charCount || '0'}/${textAreaMaxLength}`}</span>
    );

    const quickAction =
      quickActionLabel && quickActionHandler ? (
        <div className="form-field__quick-action">
          <Button button="link" onClick={quickActionHandler} label={quickActionLabel} />
        </div>
      ) : null;

    const input = () => {
      switch (type) {
        case 'markdown':
          return (
            <div className="form-field--SimpleMDE" onContextMenu={stopContextMenu}>
              <fieldset-section>
                {!header && (
                  <div className="form-field__two-column">
                    <div>
                      <label htmlFor={name}>{label}</label>
                    </div>
                    {quickAction}
                  </div>
                )}
                {!!header && <div className="form-field__textarea-header">{header}</div>}
                <SimpleMDE
                  {...inputProps}
                  id={name}
                  events={this.editorEvents}
                  getMdeInstance={this.getEditorInstance}
                  options={this.markdownOptions}
                  textareaProps={{ disabled: inputProps.disabled }}
                />
                {countInfo}
              </fieldset-section>
            </div>
          );
        case 'textarea':
          return (
            <fieldset-section>
              {!header && (label || quickAction) && (
                <div className="form-field__two-column">
                  <label htmlFor={name}>{label}</label>
                  {quickAction}
                </div>
              )}
              {!!header && <div className="form-field__textarea-header">{header}</div>}
              {hideSuggestions ? (
                <textarea
                  type={type}
                  id={name}
                  maxLength={textAreaMaxLength || FF_MAX_CHARS_DEFAULT}
                  ref={this.input}
                  {...inputProps}
                />
              ) : (
                <TextareaWithSuggestions
                  type={type}
                  id={name}
                  maxLength={textAreaMaxLength || FF_MAX_CHARS_DEFAULT}
                  inputRef={this.input}
                  isLivestream={isLivestream}
                  {...inputProps}
                />
              )}
              <div className="form-field__textarea-info">
                {!noEmojis && openEmoteMenu && (
                  <Button
                    type="alt"
                    className="button--comment-icons"
                    title="Emotes"
                    onClick={openEmoteMenu}
                    icon={ICONS.EMOJI}
                    iconSize={20}
                  />
                )}
                {countInfo}
              </div>
            </fieldset-section>
          );
      }
    };

    return (
      <>
        {type && input()}
        {helper && <div className="form-field__help">{helper}</div>}
      </>
    );
  }
}

export default FormFieldAreaAdvanced;
