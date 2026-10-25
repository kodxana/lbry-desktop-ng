// CodeMirror 6's public surface used by the desktop. Positions are UTF-16 offsets.
declare module '@codemirror/state' {
  declare opaque type ExtensionValue;
  declare export type Extension = ExtensionValue | ReadonlyArray<Extension>;
  declare export class Text {
    readonly length: number;
    readonly lines: number;
    toString(): string;
    sliceString(from: number, to?: number): string;
    lineAt(position: number): {from: number, to: number, number: number, text: string, length: number};
  }
  declare export type SelectionRange = {readonly from: number, readonly to: number, readonly anchor: number, readonly head: number, readonly empty: boolean};
  declare export class EditorSelection { readonly main: SelectionRange; }
  declare export class Annotation<out T> { readonly value: T; static define<T>(): AnnotationType<T>; }
  declare export class AnnotationType<T> { of(value: T): Annotation<T>; }
  declare export class StateEffect<T> { readonly value: T; }
  declare export class Compartment {
    of(extension: Extension): Extension;
    reconfigure(extension: Extension): StateEffect<Extension>;
  }
  declare export type ChangeSpec = {from: number, to?: number, insert?: string | Text};
  declare export type TransactionSpec = {
    changes?: ChangeSpec | ReadonlyArray<ChangeSpec>,
    selection?: {anchor: number, head?: number},
    effects?: StateEffect<Extension> | Array<StateEffect<Extension>>,
    annotations?: Annotation<unknown> | Array<Annotation<unknown>>,
    userEvent?: string,
    scrollIntoView?: boolean,
    filter?: boolean,
  };
  declare export class Transaction {
    readonly docChanged: boolean;
    readonly startState: EditorState;
    readonly newDoc: Text;
    readonly state: EditorState;
    readonly changes: {iterChanges: ((number, number, number, number, Text) => void) => void};
    isUserEvent(event: string): boolean;
    annotation<T>(type: AnnotationType<T>): T | void;
    static remote: AnnotationType<boolean>;
    static addToHistory: AnnotationType<boolean>;
    static userEvent: AnnotationType<string>;
  }
  declare export class EditorState {
    readonly doc: Text;
    readonly selection: EditorSelection;
    readonly readOnly: boolean;
    static readOnly: {of: (boolean) => Extension};
    static transactionFilter: {of: ((Transaction) => Transaction | TransactionSpec | Array<TransactionSpec>) => Extension};
    static create(config: {doc?: string, extensions?: Extension, selection?: {anchor: number, head?: number}}): EditorState;
  }
}

declare module '@codemirror/view' {
  import type {EditorState, Extension, Transaction, TransactionSpec} from '@codemirror/state';
  declare export type KeyBinding = {key: string, run: (EditorView) => boolean, ...};
  declare export type ViewUpdate = {
    readonly view: EditorView, readonly state: EditorState, readonly startState: EditorState,
    readonly docChanged: boolean, readonly selectionSet: boolean, readonly viewportChanged: boolean, readonly transactions: Array<Transaction>,
  };
  declare export class EditorView {
    constructor(config: {parent?: HTMLElement, doc?: string, state?: EditorState, extensions?: Extension}): void;
    readonly state: EditorState;
    readonly dom: HTMLDivElement;
    readonly contentDOM: HTMLDivElement;
    readonly hasFocus: boolean;
    dispatch(spec: TransactionSpec): void;
    focus(): void;
    destroy(): void;
    static lineWrapping: Extension;
    static theme(styles: {[string]: {...}}, options?: {dark?: boolean}): Extension;
    static editable: {of: (boolean) => Extension};
    static contentAttributes: {of: ({[string]: string}) => Extension};
    static updateListener: {of: ((ViewUpdate) => void) => Extension};
    static domEventHandlers(handlers: {contextmenu?: (MouseEvent, EditorView) => void}): Extension;
  }
  declare export var keymap: {of: (Array<KeyBinding>) => Extension};
  declare export function placeholder(text: string): Extension;
  declare export function lineNumbers(): Extension;
}

declare module '@codemirror/commands' {
  import type {Extension} from '@codemirror/state';
  import type {KeyBinding, EditorView} from '@codemirror/view';
  declare export function indentMore(view: EditorView): boolean;
  declare export function indentLess(view: EditorView): boolean;
  declare export function history(): Extension;
  declare export var historyKeymap: Array<KeyBinding>;
  declare export var defaultKeymap: Array<KeyBinding>;
}

declare module '@codemirror/lang-markdown' {
  import type {Extension} from '@codemirror/state';
  import type {KeyBinding} from '@codemirror/view';
  import type {Language} from '@codemirror/language';
  declare export var markdownLanguage: Language;
  declare export function markdown(config?: {base?: Language}): Extension;
  declare export var markdownKeymap: Array<KeyBinding>;
}

declare module '@codemirror/language' {
  import type {Extension} from '@codemirror/state';
  import type {Tag} from '@lezer/highlight';
  declare export opaque type Language;
  declare export class HighlightStyle {
    static define(styles: Array<{tag: Tag, class: string}>): HighlightStyle;
  }
  declare export function syntaxHighlighting(style: HighlightStyle): Extension;
}

declare module '@codemirror/language-data' {
  import type {Extension} from '@codemirror/state';
  declare export var languages: Array<{name: string, alias: Array<string>, extensions: Array<string>, load: () => Promise<Extension>}>;
}

declare module '@lezer/highlight' {
  declare export opaque type Tag;
  declare export var tags: {[string]: Tag};
}
