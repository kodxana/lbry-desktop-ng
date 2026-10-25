// @flow
import { FF_MAX_CHARS_DEFAULT } from 'constants/form-field';
import { stopContextMenu } from 'util/context-menu';
import * as ICONS from 'constants/icons';
import Button from 'component/button';
import React from 'react';
import MarkdownEditor from 'component/common/markdown-editor';
import TextareaWithSuggestions from 'component/textareaWithSuggestions';
import type { Node } from 'react';

type Props = {
  autoFocus?: boolean,
  blockWrap: boolean,
  charCount?: number,
  children?: React.Node,
  disabled?: boolean,
  helper?: string | React.Node,
  hideSuggestions?: boolean,
  isLivestream?: boolean,
  label?: string | Node,
  labelOnLeft: boolean,
  name: string,
  noEmojis?: boolean,
  placeholder?: string,
  quickActionLabel?: string,
  textAreaMaxLength?: number,
  type?: string,
  value?: string | number,
  onChange?: (any) => any,
  openEmoteMenu?: () => void,
  quickActionHandler?: (any) => any,
  render?: () => React.Node,
  header?: React.Node,
};

export class FormFieldAreaAdvanced extends React.PureComponent<Props> {
  static defaultProps: { labelOnLeft: boolean, blockWrap: boolean } = { labelOnLeft: false, blockWrap: true };

  input: { current: HTMLTextAreaElement | null };
  constructor(props: Props) {
    super(props);
    this.input = React.createRef();
  }

  componentDidMount() {
    const { autoFocus } = this.props;
    const input = this.input.current;

    if (input && autoFocus) input.focus();
  }

  render(): React.Node {
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
            <div className="form-field--markdown" onContextMenu={stopContextMenu}>
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
                <MarkdownEditor
                  {...inputProps}
                  name={name}
                  label={typeof label === 'string' ? label : name}
                  autoFocus={autoFocus}
                  textAreaMaxLength={textAreaMaxLength}
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
