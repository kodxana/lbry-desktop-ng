// @flow
export type MarkdownEditorProps = {
  name: string,
  label?: string,
  value?: string | number,
  disabled?: boolean,
  autoFocus?: boolean,
  placeholder?: string,
  textAreaMaxLength?: number,
  onChange?: (string) => unknown,
};
