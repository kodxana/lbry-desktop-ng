/* eslint no-console:0 */
const assert = require('assert').strict;
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

if (process.argv[2] !== '--child') {
  for (const NODE_ENV of ['production', 'development']) {
    const result = spawnSync(process.execPath, [__filename, '--child'], {
      env: { ...process.env, NODE_ENV },
      stdio: 'inherit',
      timeout: 30000,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
  }
} else {
  const babel = require('@babel/core');
  const React = require('react');
  const compile = (source, filename = 'build/tests/compiler-fixture.jsx') =>
    babel.transformSync(source, {
      filename: path.resolve(__dirname, '..', filename),
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    }).code;
  const evaluate = (source, filename, globals = {}) => {
    const module = { exports: {} };
    vm.runInNewContext(compile(source, filename), {
      require,
      module,
      exports: module.exports,
      React,
      $RefreshReg$: () => {},
      $RefreshSig$: () => (value) => value,
      ...globals,
    });
    return module.exports;
  };

  const main = async () => {
    const buildConfig = require('../webpack.base.config');
    assert.equal(buildConfig.mode, process.env.NODE_ENV);
    assert.equal(
      buildConfig.devtool,
      process.env.NODE_ENV === 'production' ? 'source-map' : 'eval-cheap-module-source-map'
    );
    const { Form, transform, spread, values, reject } = evaluate(`
      type Props = { label: string };
      class Base {
        set value(_) { throw new Error('A class field must not invoke an inherited setter'); }
      }
      export class Form extends Base {
        props: Props;
        value = 7;
        #secret = 'private';
        #read() { return this.#secret; }
        read = () => this.#read();
        static owns(value) { return #secret in value; }
        render() { return <button {...this.props} disabled={false}>Save</button>; }
      }
      export async function transform(input: ?{ count?: number }) {
        const { omitted, ...rest } = { omitted: true, ...(input ?? {}) };
        await Promise.resolve();
        return { ...rest, count: input?.count ?? 9 };
      }
      export async function* values() { yield 1; yield await Promise.resolve(2); }
      export async function reject() { throw new Error('fixture failure'); }
      export const spread = input => ({ ...input });
    `);
    const form = new Form();
    assert(Object.prototype.hasOwnProperty.call(form, 'props'), 'Preserve the existing Flow field initialization');
    assert.equal(form.props, undefined);
    assert.equal(form.value, 7);
    assert.equal(Object.getOwnPropertyDescriptor(form, 'value').enumerable, true);
    assert.equal(form.read(), 'private');
    assert(Form.owns(form));
    assert(!Form.owns({}));
    assert.deepEqual(Object.keys(form).sort(), ['props', 'read', 'value']);
    form.props = { label: 'Backup' };
    const element = form.render();
    assert(React.isValidElement(element));
    assert(require('react-is').isElement(element), 'Element detection must match the installed React runtime');
    assert.equal(
      require.resolve('react-is', { paths: [path.dirname(require.resolve('@mui/utils'))] }),
      require.resolve('react-is'),
      'Material UI must use the same React element symbols'
    );
    assert.equal(element.type, 'button');
    assert.equal(element.props.label, 'Backup');
    assert.equal(element.props.children, 'Save');
    assert.equal(element.props.disabled, false);
    const symbol = Symbol('saved');
    const result = await transform({ count: 0, saved: 'kept' });
    assert.equal(result.count, 0);
    assert.equal(result.saved, 'kept');
    assert.equal(spread({ [symbol]: 'kept' })[symbol], 'kept');
    assert(!('omitted' in result));
    assert.equal((await transform(null)).count, 9);
    const yielded = [];
    for await (const value of values()) yielded.push(value);
    assert.deepEqual(yielded, [1, 2]);
    await assert.rejects(reject(), /fixture failure/);

    // Video.js supplies native constructors outside Babel's transformed modules.
    class NativeComponent {
      constructor(value) {
        this.value = value;
      }
    }
    const { Player } = evaluate(
      'export class Player extends NativeComponent { constructor(value) { super(value); } read = () => this.value; }',
      'ui/component/viewers/videoViewer/internal/compiler-fixture.jsx',
      { NativeComponent }
    );
    const player = new Player('playing');
    assert(player instanceof NativeComponent);
    assert.equal(player.read(), 'playing');

    const esm = babel.transformSync('export const load = () => import("./lazy.js");', {
      filename: path.resolve(__dirname, 'tests/compiler-lazy.js'),
    }).code;
    assert.match(esm, /import\(["']\.\/lazy\.js["']\)/, 'Webpack must retain dynamic imports for lazy chunks');
    assert.match(esm, /export/, 'Webpack must receive ESM exports');
    const registrations = [];
    evaluate(
      `
      import React from 'react';
      function useFixture() { return React.useState(0); }
      export function Editor() {
        const [count] = useFixture();
        return <span>{count}</span>;
      }
    `,
      'ui/component/compiler-hot.jsx',
      {
        $RefreshReg$: (value, name) => registrations.push(name),
      }
    );
    assert.equal(registrations.includes('Editor'), process.env.NODE_ENV === 'development');
    for (const filename of ['electron/compiler-fixture.js', 'build/tests/compiler-fixture.jsx']) {
      assert(
        !compile('export function Editor() { return <span />; }', filename).includes('$Refresh'),
        'Refresh instrumentation must stay out of main-process and test modules'
      );
    }
    const sandbox = spawnSync(process.execPath, [path.join(__dirname, '../electron/sandboxTest.js')], {
      env: { ...process.env, BABEL_DISABLE_CACHE: '1' },
      encoding: 'utf8',
      timeout: 30000,
    });
    if (sandbox.error) throw sandbox.error;
    assert.equal(sandbox.status, 0, sandbox.stdout + sandbox.stderr);
    console.log(
      'PASS: ' +
        process.env.NODE_ENV +
        ' compiler: Flow fields, React JSX, public/private fields, async errors/generators, symbols, native player inheritance, lazy imports, renderer-only Fast Refresh and register entry point'
    );
  };
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
