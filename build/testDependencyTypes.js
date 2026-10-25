/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const versions = {
  'lz-string': '1.5.0',
  'json-stringify-safe': '5.0.1',
  'country-data-list': '1.6.3',
  'react-redux': '9.3.0',
  express: '5.3.0',
  localforage: '1.10.0',
  prettier: '3.9.10',
  chalk: '6.0.1',
  classnames: '2.5.1',
  reselect: '5.3.0',
  webpack: '5.112.2',
  'react-modal': '3.16.3',
  '@videojs/react': '10.2.0',
};
const manifest = require('../package.json');
const parent = path.join(root, 'dist', 'flow-tests');
fs.mkdirSync(parent, { recursive: true });
const cwd = fs.mkdtempSync(path.join(parent, 'dependencies-'));
const write = (file, source) => {
  const target = path.join(cwd, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
};
write('.flowconfig', fs.readFileSync(path.join(root, '.flowconfig'), 'utf8'));
write(
  'ui/constants/action_types.js',
  '// @flow\n' + fs.readFileSync(path.join(root, 'ui/constants/action_types.js'), 'utf8')
);
const modules = new Set();
let definitionCount = 0;
for (const file of fs
  .readdirSync(path.join(root, 'flow-typed'), { recursive: true })
  .filter((file) => file.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(root, 'flow-typed', file), 'utf8');
  const names = [...source.matchAll(/declare module ['"]([^'"]+)['"]/g)].map((match) => match[1]);

  for (const name of names) {
    assert(!modules.has(name), `Duplicate dependency definition: ${name}`);
    modules.add(name);
  }
  write(`flow-typed/${file}`, source);
  definitionCount++;
}
for (const [name, version] of Object.entries(versions)) {
  assert(modules.has(name), `Missing dependency definition: ${name}`);
  assert.equal(
    manifest.dependencies[name] || manifest.devDependencies[name],
    version,
    `Review ${name}'s contracts on upgrade`
  );
}
write('contracts.jsx', fs.readFileSync(path.join(__dirname, 'tests/dependencyTypes.jsx'), 'utf8'));
write('remaining.jsx', fs.readFileSync(path.join(__dirname, 'tests/remainingDependencyTypes.jsx'), 'utf8'));
const check = () => {
  const result = spawnSync(require('flow-bin'), ['full-check', '--max-workers', '2', '--json', '--strip-root'], {
    cwd,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert([0, 2].includes(result.status), result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.passed, result.status === 0);
  return report;
};
assert.deepEqual(check().errors, [], 'Current dependency APIs and valid application patterns must type-check');
const invalid = {
  'player-rate':
    "import {usePlayer} from '@videojs/react/video'; export function read(): string { return usePlayer(s => s.playbackRate); }",
  'player-snapshot':
    "import {usePlayer} from '@videojs/react/video'; export function read(): void { usePlayer().getSnapshot(); }",
  'player-quality':
    "import {useQualityOptions} from '@videojs/react'; export function select(): void { useQualityOptions()?.setValue(720); }",
  'player-media':
    "import * as React from 'react'; import {HlsJsVideo} from '@videojs/react/media/hlsjs-video'; export const video: React.Node = <HlsJsVideo src={42} />;",
  'codec-input': "import {compressToUTF16} from 'lz-string'; compressToUTF16({state: true});",
  'codec-null':
    "import {decompressFromUTF16} from 'lz-string'; export const text: string = decompressFromUTF16('invalid');",
  'safe-json-undefined':
    "import stringify from 'json-stringify-safe'; export const text: string = stringify(undefined);",
  'country-name': "import { countries } from 'country-data-list'; export const value: number = countries.all[0].name;",
  'country-status':
    "import { countries } from 'country-data-list'; export const value: number = countries.all[0].status;",
  'tab-selection': "import {useTabStore} from '@ariakit/react'; useTabStore({selectedId: 3});",
  'menu-context':
    "import {useMenuContext} from '@ariakit/react'; export function read(): boolean { return useMenuContext().getState().open; }",
  'lightbox-image':
    "import * as React from 'react'; import Lightbox from 'react-awesome-lightbox'; export const image: React.Node = <Lightbox image={5} onClose={() => {}} />;",
  'html-attribute':
    "import {parse} from 'node-html-parser'; export const value: number = parse('<img>').getAttribute('src');",
  'selector-composed-params':
    "import {createSelector} from 'reselect'; const read = createSelector((s: {balance: string}, index: number): string => s.balance, (v: string): string => v); const composed = createSelector(read, (v: string): string => v); composed({balance: '0'});",
  'selector-optional-type':
    "import {createSelector} from 'reselect'; const read = createSelector((s: string, index: number = 0): string => s, (v: string): string => v); read('fixture', 'wrong');",
  'selector-input':
    "import {createSelector} from 'reselect'; createSelector((s: {balance: string}): string => s.balance, (balance: number): number => balance);",
  'selector-result':
    "import {createSelector} from 'reselect'; const read = createSelector((s: {balance: string}): string => s.balance, (v: string): string => v); export const balance: number = read({balance: '0'});",
  'selector-params':
    "import {createSelector} from 'reselect'; const read = createSelector((s: {balance: string}, index: number): string => s.balance, (v: string): string => v); read({balance: '0'});",
  'selector-param-type':
    "import {createSelector} from 'reselect'; const read = createSelector((s: {balance: string}, index: number): string => s.balance, (v: string): string => v); read({balance: '0'}, 'wrong');",
  'selector-third-arg':
    "import {createSelector} from 'reselect'; const read = createSelector((s: {balance: string}, index: number, suffix: string): string => s.balance + suffix, (v: string): string => v); read({balance: '0'}, 1);",
  'selector-state':
    "import {createSelector} from 'reselect'; const read = createSelector((s: {balance: string}): string => s.balance, (v: string): string => v); read({balance: 1});",
  'selector-typed-state':
    "import {createSelector} from 'reselect'; createSelector.withTypes<{balance: string}>()([(s: {balance: number}): number => s.balance], (value: number): number => value);",
  'selector-typed-result':
    "import {createSelector} from 'reselect'; const read = createSelector.withTypes<{balance: string}>()([(s) => s.balance], (value) => value); export const value: number = read({balance: '0'});",
  'selector-result-func':
    "import {createSelector} from 'reselect'; const read = createSelector((s: {balance: string}): string => s.balance, (v: string): string => v); read.resultFunc(10);",
  'selector-reset':
    "import {createSelector} from 'reselect'; const read = createSelector((s: string): string => s, (v: string): string => v); export const count: number = read.resetRecomputations();",
  'selector-removed': "import {defaultMemoize} from 'reselect'; defaultMemoize((value: string): string => value);",
  'memoize-result':
    "import {lruMemoize} from 'reselect'; const read = lruMemoize((value: string): number => value.length); export const value: string = read('fixture');",
  'memoize-options':
    "import {lruMemoize} from 'reselect'; lruMemoize((value: string): string => value, {maxSize: '2'});",
  'webpack-mode': "import webpack from 'webpack'; webpack({mode: 'release'});",
  'webpack-rule': "import webpack from 'webpack'; webpack({module: {rules: [{type: 'raw-loader'}]}});",
  'webpack-stats': "import webpack from 'webpack'; webpack({}).run((error, stats) => { stats.hasErrors(); });",
  'webpack-ignore': "import webpack from 'webpack'; new webpack.IgnorePlugin(/removed-overload/);",
  'webpack-provide': "import webpack from 'webpack'; new webpack.ProvidePlugin({value: 10});",
  'webpack-multi': "import webpack from 'webpack'; webpack({}).compilers;",
  'modal-open':
    "import * as React from 'react'; import Modal from 'react-modal'; export const modal: React.Node = <Modal isOpen=\"true\" />;",
  'modal-timeout':
    "import * as React from 'react'; import Modal from 'react-modal'; export const modal: React.Node = <Modal isOpen closeTimeoutMS=\"100\" />;",
  'modal-element': "import Modal from 'react-modal'; Modal.setAppElement(42);",
  'modal-close-event':
    "import * as React from 'react'; import Modal from 'react-modal'; export const modal: React.Node = <Modal isOpen onRequestClose={(event: number) => {}} />;",
  'connected-props': `import * as React from 'react'; import {connect} from 'react-redux';
    function View(p: {balance: number}): React.Node { return null; }
    const Wrapped = connect((s: {balance: string}): {balance: string} => s)(View);`,
  'connected-own-props': `import * as React from 'react'; import {connect} from 'react-redux';
    function View(p: {address: string, balance: string}): React.Node { return null; }
    const Connected = connect((s: {balance: string}): {balance: string} => s)(View);
    export const view: React.Node = <Connected />;`,
  'connected-thunk': `import * as React from 'react'; import {connect} from 'react-redux';
    function View(p: {save: (amount: string) => string}): React.Node { return null; }
    const Wrapped = connect(null, {save: (amount: string): (() => Promise<string>) => () => Promise.resolve(amount)})(View);`,
  'connected-options': `import {connect} from 'react-redux'; connect(null, null, null, {pure: false});`,
  'connected-actions': `import {connect} from 'react-redux'; connect(null, {save: 1});`,
  selector: `import {useSelector} from 'react-redux'; export function read(): number {
    return useSelector((s: {balance: string}) => s.balance); }`,
  dispatch: `import {useDispatch} from 'react-redux'; export function wrong(): void { useDispatch()(42); }`,
  store: `import {useStore} from 'react-redux'; useStore.withTypes<{getState(): string}>();`,
  'removed-provider': `import {createProvider} from 'react-redux'; createProvider();`,
  'removed-connect': `import {connectAdvanced} from 'react-redux'; connectAdvanced();`,
  'prettier-sync': `import * as prettier from 'prettier'; export const text: string = prettier.format('let x=1');`,
  'prettier-config-sync': `import * as prettier from 'prettier'; prettier.resolveConfig.sync('fixture.js');`,
  'prettier-parser': `import * as prettier from 'prettier'; prettier.format('let x=1', {parser: () => ({})});`,
  'prettier-option': `import * as prettier from 'prettier'; prettier.format('let x=1', {printWidth: '80'});`,
  'storage-clear': `import storage from 'localforage'; export const count: Promise<number> = storage.clear();`,
  'storage-missing': `import storage from 'localforage'; export async function read(): Promise<string> { return await storage.getItem<string>('missing'); }`,
  'storage-key': `import storage from 'localforage'; export async function key(): Promise<string> { return await storage.key(100); }`,
  'storage-callback': `import storage from 'localforage'; storage.length((count: number) => {});`,
  'storage-callback-failure': `import storage from 'localforage'; storage.length((error: unknown, count: number) => {});`,
  'storage-undefined': `import storage from 'localforage'; export const result: Promise<void> = storage.setItem('empty', undefined);`,
  'storage-version': `import storage from 'localforage'; storage.config({version: '1'});`,
  'express-status': `import type {Response} from 'express'; export function send(response: Response): void { response.status('200'); }`,
  'express-listen': `import express from 'express'; express().listen(true);`,
  'express-param': `import type {Request} from 'express'; export function read(request: Request): void { request.param('id'); }`,
  'express-json': `import type {Response} from 'express'; export function send(response: Response): void { response.json(200, {}); }`,
  'express-static': `import express from 'express'; express.static('.', {dotfiles: 'include'});`,
  classnames: `import classes from 'classnames'; export const value: number = classes('one', ['two']);`,
  chalk: `import chalk from 'chalk'; export const value: number = chalk.bold('test');`,
};
for (const [name, source] of Object.entries(invalid)) write(`invalid-${name}.js`, '// @flow\n' + source);
const failed = check();
assert.equal(failed.passed, false);
for (const name of Object.keys(invalid)) {
  assert(
    failed.errors.some((error) => error.message.some((message) => message.loc?.source?.endsWith(`invalid-${name}.js`))),
    `Invalid ${name} contract must fail`
  );
}
console.log(
  `PASS ${definitionCount} definition files, ${Object.keys(versions).length} dependency contracts and ${Object.keys(invalid).length} invalid contracts`
);
