/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const versions = {
  'react-redux': '9.3.0',
  express: '5.3.0',
  localforage: '1.10.0',
  prettier: '3.9.10',
  chalk: '6.0.1',
  classnames: '2.5.1',
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
const modules = new Set();
for (const file of fs
  .readdirSync(path.join(root, 'flow-typed'), { recursive: true })
  .filter((file) => file.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(root, 'flow-typed', file), 'utf8');
  const names = [...source.matchAll(/declare module ['"]([^'"]+)['"]/g)].map((match) => match[1]);
  if (!names.some((name) => Object.hasOwn(versions, name))) continue;
  for (const name of names) {
    assert(!modules.has(name), `Duplicate dependency definition: ${name}`);
    modules.add(name);
  }
  write(`flow-typed/${file}`, source);
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
console.log(`PASS six dependency definitions, valid APIs and ${Object.keys(invalid).length} invalid contracts`);
