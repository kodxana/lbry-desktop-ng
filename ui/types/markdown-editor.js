// @flow

// The CodeMirror 5 / EasyMDE surface used by the shared Markdown field.
export type EditorPosition = { line: number, ch: number };

export type EditorChange = {
  from: EditorPosition,
  to: EditorPosition,
  text: Array<string>,
  origin?: string,
  ...
};

export type EditorBeforeChange = {
  ...EditorChange,
  cancel: () => void,
  update?: (EditorPosition, EditorPosition, Array<string>) => void,
  ...
};

export interface MarkdownCodeMirror {
  indexFromPos(EditorPosition): number;
  getValue(): string;
  getWrapperElement(): HTMLElement;
  getInputField(): HTMLElement;
  setSelection(EditorPosition, EditorPosition): void;
  setOption('readOnly', boolean): void;
  setOption('placeholder', string): void;
}

export type MarkdownEditor = {
  codemirror: MarkdownCodeMirror,
  gui: { toolbar: HTMLElement, ... },
  ...
};
