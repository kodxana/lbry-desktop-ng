/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const parent = path.join(root, 'dist/flow-tests');
fs.mkdirSync(parent, { recursive: true });
const cwd = fs.mkdtempSync(path.join(parent, 'content-'));
const write = (file, source) => {
  fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  fs.writeFileSync(path.join(cwd, file), source);
};
for (const file of [
  '.flowconfig',
  'flow-typed/npm/codemirror.js',
  'ui/util/editor-theme.js',
  'flow-typed/i18n.js',
  'ui/redux/selectors/content.js',
  'ui/effects/use-lazy-loading.js',
  'ui/component/viewers/documentViewer.jsx',
  'ui/component/viewers/docxViewer.jsx',
  'ui/component/viewers/codeViewer.jsx',
  'ui/component/common/loading-screen.jsx',
  'ui/constants/file_render_modes.js',
  'ui/constants/claim.js',
  'ui/constants/tags.js',
  'flow-typed/npm/reselect_v5.x.x.js',
  'flow-typed/npm/classnames_v2.x.x.js',
])
  write(file, fs.readFileSync(path.join(root, file), 'utf8'));
for (const file of fs.readdirSync(path.join(root, 'flow-typed')).filter((file) => file.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(root, 'flow-typed', file), 'utf8');
  if (!/declare module\s/.test(source)) write('flow-typed/' + file, source);
}
// Check the actual source against the dependency APIs used by these modules.
write(
  'flow-typed/inputs.js',
  `
declare module 'redux/selectors/claims' {
  type State = {claims: ClaimsState, ...};
  declare export function makeSelectClaimForUri(uri: string): (State) => ?Claim;
  declare export function selectClaimIsNsfwForUri(state: State, uri: string): boolean;
  declare export function selectClaimIsMineForUri(state: State, uri: string): boolean;
  declare export function makeSelectClaimIsNsfw(uri: string): (State) => boolean;
  declare export function makeSelectContentTypeForUri(uri: string): (State) => string | void;
}
declare module 'redux/selectors/file_info' {
  declare export function makeSelectMediaTypeForUri(uri: string): ({...}) => string | void;
  declare export function makeSelectFileNameForUri(uri: string): ({...}) => ?string;
}
declare module 'redux/selectors/wallet' { declare export function selectBalance(state: {...}): number; }
declare module 'redux/selectors/settings' { declare export function selectShowMatureContent(state: {...}): boolean; }
declare module 'lbryinc' { declare export function selectCostInfoForUri(state: {...}, uri: string): ?{cost: number, ...}; }
declare module 'util/file-name' { declare export default {extname: (string) => string}; }
declare module 'util/desktop' { declare export default {readDocument: (string) => Promise<Uint8Array>}; }
declare module 'util/document-html' { declare export default (string) => string; }
declare module 'component/common/markdown-preview' {
  import type {ComponentType} from 'react';
  declare export default ComponentType<{content: ?string, isMarkdownPost: boolean}>;
}
declare module 'component/spinner' {
  import type {ComponentType, Node} from 'react';
  declare export default ComponentType<{light: boolean, delayed: boolean, text: Node}>;
}
declare module 'mammoth' {
  declare export default {convertToHtml: ({arrayBuffer: ArrayBuffer}, {externalFileAccess: boolean, styleMap: Array<string>}) => Promise<{value: string}>};
}
declare module 'util/context-menu' {
  declare export function openSnippetMenu(...args: Array<unknown>): void;
  declare export function stopContextMenu(event: {preventDefault: () => void, stopPropagation: () => void, ...}): void;
}
`
);
const fixture = `// @flow
import * as React from 'react';
import {EditorState} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import Document from 'component/viewers/documentViewer';
import Docx from 'component/viewers/docxViewer';
import Code from 'component/viewers/codeViewer';
import useLazyLoading from 'effects/use-lazy-loading';
import * as content from 'redux/selectors/content';
export const playing: PlayingUri = {uri: null, primaryUri: null};
export const state: ContentState = {primaryUri: null, playingUri: playing, positions: {id: {'tx:0': null}}, history: []};
export const read = (): Promise<Uint8Array> => Promise.resolve(new Uint8Array());
export const document: React.Node = <Document theme="dark" renderMode="markdown" source={{file: read, contentType: 'text/markdown'}} />;
export const docx: React.Node = <Docx source="file.docx" />;
export const code: React.Node = <Code theme="dark" value={null} contentType="text/plain" />;
export function useImage(ref: Readonly<{current: HTMLImageElement | null}>): boolean {return useLazyLoading(ref, '', 100, ['image']);}
export function percentage(claims: ClaimsState): number {return content.makeSelectContentWatchedPercentageForUri('uri')({claims, content: state});}
export function missing(claims: ClaimsState): ?PlayingUri {return content.selectPlayingUri({claims});}
`;
write('valid.jsx', fixture);
const check = () => {
  const result = spawnSync(require('flow-bin'), ['full-check', '--max-workers', '2', '--json', '--strip-root'], {
    cwd,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert([0, 2].includes(result.status), result.stdout + result.stderr);
  return JSON.parse(result.stdout);
};
assert.deepEqual(check().errors, [], 'Content/viewer source and valid callers must type-check');
const invalid = {
  editorReadonly: 'export const invalid = EditorState.readOnly.of("true");',
  editorOffset: 'export function invalid(view: EditorView): void {view.dispatch({selection: {anchor: "1"}});}',
  editorChange: 'export function invalid(view: EditorView): void {view.dispatch({changes: {from: 0, insert: 42}});}',

  playing: 'export const invalid: PlayingUri = {uri: 1, primaryUri: null};',
  position: 'export const invalid: ContentState = {...state, positions: {id: {tx: "25"}}};',
  history: 'export const invalid: ContentHistoryItem = {uri: "uri", lastViewed: "today"};',
  loop: 'export const invalid: ContentState = {...state, loopList: {collectionId: "id", loop: "yes"}};',
  documentBytes:
    'export const invalid: React.Node = <Document theme="dark" renderMode="markdown" source={{file: () => Promise.resolve("text"), contentType: "text/plain"}} />;',
  documentRead:
    'export const invalid: React.Node = <Document theme="dark" renderMode="markdown" source={{file: () => new Uint8Array(), contentType: "text/plain"}} />;',
  docxPath: 'export const invalid: React.Node = <Docx source={undefined} />;',
  editor: 'export const invalid: React.Node = <Code theme="dark" contentType="text/plain" value={123} />;',
  lazyRef: 'export function useInvalid(): boolean {return useLazyLoading({current: "image"});}',
  percent:
    'export function invalid(claims: ClaimsState): string {return content.makeSelectContentWatchedPercentageForUri("uri")({claims, content: state});}',
};
for (const [name, source] of Object.entries(invalid)) write('invalid-' + name + '.jsx', fixture + '\n' + source);
const failed = check();
for (const name of Object.keys(invalid))
  assert(
    failed.errors.some(
      (error) =>
        !error.error_codes.includes('signature-verification-failure') &&
        error.message.some((message) => message.loc?.source.endsWith('invalid-' + name + '.jsx'))
    ),
    'Incorrect ' + name + ' contract must be rejected'
  );
console.log('PASS content/viewer source and ' + Object.keys(invalid).length + ' invalid contracts');
