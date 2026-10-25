// @flow
import { FF_MAX_CHARS_DEFAULT } from 'constants/form-field';
import React from 'react';
import type { Node } from 'react';

type FieldEvent = {
  target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  currentTarget: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  preventDefault: () => void,
  stopPropagation: () => void,
  ...
};

type Props = {
  affixClass?: string, // class applied to prefix/postfix label
  autoFocus?: boolean,
  blockWrap: boolean,
  charCount?: number,
  children?: React.Node,
  defaultValue?: string | number,
  disabled?: boolean,
  checked?: boolean,
  className?: string,
  id?: string,
  step?: number | 'any',
  maxLength?: number,
  onWheel?: ({ preventDefault: () => void, ... }) => void,
  onClick?: (FieldEvent) => unknown,
  onBlur?: (FieldEvent) => unknown,
  onKeyPress?: ({ ...FieldEvent, key: string, charCode: number }) => unknown,
  onKeyDown?: ({ ...FieldEvent, key: string, code: string, repeat: boolean }) => unknown,
  error?: string | boolean | { message: string, ... },
  helper?: string | React.Node,
  inputButton?: React.Node,
  inputName?: string,
  label?: string | Node,
  labelOnLeft: boolean,
  max?: number,
  min?: number,
  name: string,
  placeholder?: string | number,
  postfix?: string,
  prefix?: string,
  range?: number,
  readOnly?: boolean,
  stretch?: boolean,
  textAreaMaxLength?: number,
  type?: string,
  value?: string | number,
  onChange?: (any) => any,
  render?: () => React.Node,
};

export class FormField extends React.PureComponent<Props> {
  static defaultProps: { labelOnLeft: boolean, blockWrap: boolean } = { labelOnLeft: false, blockWrap: true };

  input: { current: HTMLInputElement | HTMLTextAreaElement | null };

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
      affixClass,
      autoFocus,
      blockWrap,
      charCount,
      children,
      error,
      helper,
      inputButton,
      inputName,
      label,
      labelOnLeft,
      name,
      postfix,
      prefix,
      stretch,
      textAreaMaxLength,
      type,
      render,
      ...inputProps
    } = this.props;

    const errorMessage = typeof error === 'object' ? error.message : error;

    const hasCharCount = charCount !== undefined && charCount >= 0;
    const countInfo = hasCharCount && textAreaMaxLength !== undefined && (
      <span className="comment__char-count-mde">{`${charCount || '0'}/${textAreaMaxLength}`}</span>
    );
    const Wrapper: ({ children: React.Node }) => React.Node = blockWrap
      ? ({ children: innerChildren }) => <fieldset-section class="radio">{innerChildren}</fieldset-section>
      : ({ children: innerChildren }) => <span className="radio">{innerChildren}</span>;

    const inputSimple = (type: string): React.Node => (
      <>
        <input id={name} name={inputName} type={type} {...inputProps} />
        <label htmlFor={name}>{label}</label>
      </>
    );

    const inputSelect = (selectClass: string): React.Node => (
      <fieldset-section class={selectClass}>
        {(label || errorMessage) && (
          <label htmlFor={name}>{errorMessage ? <span className="error__text">{errorMessage}</span> : label}</label>
        )}
        <select id={name} {...inputProps}>
          {children}
        </select>
      </fieldset-section>
    );

    const input = (): React.Node => {
      switch (type) {
        case 'radio':
          return <Wrapper>{inputSimple('radio')}</Wrapper>;
        case 'checkbox':
          return <div className="checkbox">{inputSimple('checkbox')}</div>;
        case 'range':
          return <div>{inputSimple('range')}</div>;
        case 'select':
          return inputSelect('');
        case 'select-tiny':
          return inputSelect('select--slim');
        case 'textarea':
          return (
            <fieldset-section>
              {label && (
                <div className="form-field__two-column">
                  <label htmlFor={name}>{label}</label>
                </div>
              )}
              <textarea
                type={type}
                id={name}
                maxLength={textAreaMaxLength || FF_MAX_CHARS_DEFAULT}
                ref={this.input}
                {...inputProps}
              />
              <div className="form-field__textarea-info">{countInfo}</div>
            </fieldset-section>
          );
        default:
          const inputElement = <input type={type} id={name} {...inputProps} ref={this.input} />;
          const inner = inputButton ? (
            <input-submit>
              {inputElement}
              {inputButton}
            </input-submit>
          ) : (
            inputElement
          );

          return (
            <fieldset-section>
              {(label || errorMessage) && (
                <label htmlFor={name}>
                  {errorMessage ? <span className="error__text">{errorMessage}</span> : label}
                </label>
              )}
              {prefix && <label htmlFor={name}>{prefix}</label>}
              {inner}
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

export default FormField;
