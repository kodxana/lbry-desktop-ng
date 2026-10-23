/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const reselect = require('reselect');
const webpack = require('webpack');

function selectors() {
  const { createSelector, createSelectorCreator, lruMemoize, weakMapMemoize } = reselect;
  assert.equal(reselect.defaultMemoize, undefined);
  assert.equal(createSelector.withTypes(), createSelector);
  const read = createSelector(
    [(state) => state.wallet.balance, (state, address) => address],
    (balance, address) => ({ balance, address }),
    { devModeChecks: { inputStabilityCheck: 'always', identityFunctionCheck: 'always' } }
  );
  const state = { wallet: { balance: '0.125' } };
  assert.equal(read.lastResult(), undefined);
  const first = read(state, 'fixture');
  assert.deepEqual(first, { balance: '0.125', address: 'fixture' });
  assert.equal(read(state, 'fixture'), first);
  assert.equal(read({ ...state }, 'fixture'), first);
  assert.equal(read.recomputations(), 1);
  assert.equal(read.dependencyRecomputations(), 2);
  const changed = { wallet: { balance: '0.250' } };
  const second = read(changed, 'fixture');
  assert.notEqual(second, first);
  assert.equal(second.balance, '0.250');
  assert.equal(read.lastResult(), second);
  assert.equal(read.resultFunc('0.500', 'other').balance, '0.500');
  assert.equal(read.resetRecomputations(), undefined);
  assert.equal(read.resetDependencyRecomputations(), undefined);
  assert.equal(read.recomputations(), 0);
  assert.equal(read.dependencyRecomputations(), 0);
  read.clearCache();
  read.memoizedResultFunc.clearCache();
  assert.notEqual(read(changed, 'fixture'), second);
  assert.equal(read.recomputations(), 1);
  assert.equal(read.dependencies.length, 2);
  const composed = createSelector(read, (value) => value.balance + value.address);
  assert.equal(composed(changed, 'fixture'), '0.250fixture');
  const optional = createSelector(
    (state, address = 'default', suffix = '!') => state.wallet.balance + address + suffix,
    (value) => ({ value })
  );
  assert.deepEqual(optional(state), { value: '0.125default!' });
  assert.deepEqual(optional(state, 'fixture', '?'), { value: '0.125fixture?' });
  const pick = (value) => value;
  const combine = createSelector(
    pick,
    pick,
    pick,
    pick,
    (state, index, suffix) => suffix,
    (a, b, c, d, suffix) => a + b + c + d + suffix
  );
  assert.equal(combine('A', 0, '!'), 'AAAA!');
  const custom = createSelectorCreator({ memoize: lruMemoize, memoizeOptions: { maxSize: 2 } });
  assert.equal(custom([pick], (value) => value.length)('fixture'), 7);
  const lru = lruMemoize((value) => ({ value }), { maxSize: 2 });
  const a = lru('a');
  const b = lru('b');
  assert.equal(lru('a'), a);
  lru('c');
  assert.notEqual(lru('b'), b);
  const weak = weakMapMemoize((value) => ({ value }));
  assert.equal(weak(state), weak(state));
  weak.clearCache();
  assert.equal(weak.resultsCount(), 0);
  assert.equal(weak.resetResultsCount(), undefined);
  console.log(
    'PASS Reselect string balances, required/optional arguments, composition, input/result caches, counters, typed factories and LRU eviction'
  );
}

async function compilerContracts() {
  const parent = path.resolve(__dirname, '../dist/dependency-runtime');
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'webpack-'));
  fs.writeFileSync(path.join(root, 'entry.js'), 'module.exports = CONTRACT_VALUE;');
  const config = (name) => ({
    name,
    mode: 'none',
    context: root,
    entry: './entry.js',
    output: { path: path.join(root, name), filename: 'bundle.js' },
    plugins: [new webpack.DefinePlugin({ CONTRACT_VALUE: JSON.stringify('contract-value') })],
  });
  const run = (compiler) => new Promise((resolve) => compiler.run((error, stats) => resolve({ error, stats })));
  const close = (compiler) =>
    new Promise((resolve, reject) => compiler.close((error) => (error ? reject(error) : resolve())));
  const single = webpack(config('single'));
  try {
    const { error, stats } = await run(single);
    assert.equal(error == null, true);
    assert.equal(stats.hasErrors(), false);
    assert.equal(typeof stats.toString({ all: false }), 'string');
    assert.equal(stats.toJson({ all: false, assets: true }).assets[0].name, 'bundle.js');
    assert.match(fs.readFileSync(path.join(root, 'single/bundle.js'), 'utf8'), /contract-value/);
  } finally {
    await close(single);
  }
  const multiple = webpack([config('first'), config('second')]);
  try {
    assert.equal(multiple.compilers.length, 2);
    const { error, stats } = await run(multiple);
    assert.equal(error == null, true);
    assert.equal(stats.stats.length, 2);
    assert.equal(stats.hasErrors(), false);
  } finally {
    await close(multiple);
  }
  const missing = webpack({ ...config('missing'), entry: './missing.js' });
  try {
    const { error, stats } = await run(missing);
    assert.equal(error == null, true, 'Compilation errors belong to stats');
    assert.equal(stats.hasErrors(), true);
    assert.match(stats.toJson({ all: false, errors: true }).errors[0].message, /missing/);
  } finally {
    await close(missing);
  }
  const fatal = webpack({
    ...config('fatal'),
    plugins: [
      {
        apply(compiler) {
          compiler.hooks.beforeRun.tapAsync('fatal-contract', (compiler, done) => done(new Error('fixture fatal')));
        },
      },
    ],
  });
  try {
    const { error, stats } = await run(fatal);
    assert.equal(error.message, 'fixture fatal');
    assert.equal(stats, undefined, 'Fatal compiler errors may omit stats');
  } finally {
    await close(fatal);
  }
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: 'invalid' }, (error, stats) => {
      try {
        assert.match(error.message, /mode/);
        assert.equal(stats, undefined);
        assert.equal(compiler, null);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
  console.log(
    'PASS Webpack single/multiple compilers, emitted assets, optional stats, compilation/fatal/configuration errors and close callbacks'
  );
}

async function main() {
  selectors();
  await compilerContracts();
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
