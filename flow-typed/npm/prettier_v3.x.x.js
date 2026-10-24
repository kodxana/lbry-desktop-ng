// Prettier 3's asynchronous public formatting/configuration API.
declare module 'prettier' {
  declare export type Options = {
    parser?: string,
    filepath?: string,
    printWidth?: number,
    tabWidth?: number,
    useTabs?: boolean,
    semi?: boolean,
    singleQuote?: boolean,
    jsxSingleQuote?: boolean,
    quoteProps?: 'as-needed' | 'consistent' | 'preserve',
    trailingComma?: 'none' | 'es5' | 'all',
    bracketSpacing?: boolean,
    bracketSameLine?: boolean,
    arrowParens?: 'avoid' | 'always',
    rangeStart?: number,
    rangeEnd?: number,
    requirePragma?: boolean,
    insertPragma?: boolean,
    proseWrap?: 'always' | 'never' | 'preserve',
    endOfLine?: 'auto' | 'lf' | 'crlf' | 'cr',
    singleAttributePerLine?: boolean,
    embeddedLanguageFormatting?: 'auto' | 'off',
    htmlWhitespaceSensitivity?: 'css' | 'strict' | 'ignore',
    plugins?: Array<string | { ... }>,
    ...
  };
  declare export type ResolveConfigOptions = { useCache?: boolean, config?: string | URL, editorconfig?: boolean };
  declare export function format(source: string, options?: Options): Promise<string>;
  declare export function check(source: string, options?: Options): Promise<boolean>;
  declare export function formatWithCursor(
    source: string,
    options: { ...Options, cursorOffset: number }
  ): Promise<{ formatted: string, cursorOffset: number }>;
  declare export function resolveConfig(path: string | URL, options?: ResolveConfigOptions): Promise<Options | null>;
  declare export function resolveConfigFile(path?: string | URL): Promise<string | null>;
  declare export function clearConfigCache(): Promise<void>;
  declare export function getFileInfo(
    path: string | URL,
    options?: { ignorePath?: string | Array<string>, withNodeModules?: boolean, resolveConfig?: boolean }
  ): Promise<{ ignored: boolean, inferredParser: string | null }>;
  declare export var version: string;
}
