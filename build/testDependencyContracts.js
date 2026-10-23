/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const vm = require('vm');

async function storageContracts() {
  // Run the actual localStorage driver with a private in-memory browser store.
  const values = new Map();
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('localforage'), 'utf8'), {
    module,
    exports: module.exports,
    Promise,
    setTimeout,
    localStorage: {
      get length() {
        return values.size;
      },
      key: (index) => [...values.keys()][index] ?? null,
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    },
  });
  const storage = module.exports.createInstance({ name: 'dependency-contracts' });
  assert.equal(storage.driver(), null);
  assert.equal(storage.config({ version: 1 }), true);
  const configured = storage.config({ driver: storage.LOCALSTORAGE });
  assert.equal(typeof configured.then, 'function');
  await configured;
  await storage.ready();
  assert.match(storage.config({ name: 'too-late' }).message, /Can't call config/);
  assert.equal(await storage.getItem('missing'), null);
  assert.equal(await storage.key(99), null);
  assert.equal(await storage.iterate(() => 'unreachable'), undefined);
  assert.equal(await storage.setItem('balance', '0.125'), '0.125');
  let callbackResult;
  assert.equal(
    await storage.length((error, count) => {
      callbackResult = [error, count];
    }),
    1
  );
  assert.deepEqual(callbackResult, [null, 1]);
  assert.equal(await storage.iterate((value) => value), '0.125');
  assert.equal(await storage.setItem('empty', undefined), null);
  assert.equal(await storage.getItem('empty'), null);
  const cyclic = {};
  cyclic.self = cyclic;
  let failureArgs;
  await assert.rejects(
    storage.setItem('cyclic', cyclic, (...args) => {
      failureArgs = args;
    })
  );
  assert.equal(failureArgs.length, 1);
  assert.match(failureArgs[0].message, /circular/i);
  assert.equal(await storage.clear(), undefined);
  assert.equal(await storage.length(), 0);
  await storage.dropInstance();
  console.log('PASS localForage promise/config results, null values, iteration, error-first callbacks and clear');
}

async function reduxContracts() {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const redux = require('redux');
  const { thunk } = require('redux-thunk');
  const bindings = require('react-redux');
  assert.equal(bindings.createProvider, undefined);
  assert.equal(bindings.connectAdvanced, undefined);
  assert.equal(bindings.legacy_connect, bindings.connect);
  assert.equal(bindings.useSelector.withTypes(), bindings.useSelector);
  assert.equal(bindings.useDispatch.withTypes(), bindings.useDispatch);
  const store = redux.createStore(
    (state = { balance: '0' }, action) => (action.type === 'SAVE' ? { balance: action.amount } : state),
    redux.applyMiddleware(thunk)
  );
  let saveBalance;
  const save = (amount) => async (dispatch) => {
    dispatch({ type: 'SAVE', amount });
    return amount;
  };
  // eslint-disable-next-line react/prop-types -- Plain Node runtime fixture; Flow checks its typed counterpart separately.
  function View({ balance, label, save }) {
    saveBalance = save;
    assert.equal(
      bindings.useSelector((state) => state.balance),
      balance
    );
    assert.equal(bindings.useStore(), store);
    return React.createElement('span', null, label + ': ' + balance);
  }
  const Connected = bindings.connect(() => (state) => ({ balance: state.balance }), { save })(View);
  const render = () =>
    renderToStaticMarkup(
      React.createElement(bindings.Provider, { store }, React.createElement(Connected, { label: 'Balance' }))
    );
  assert.equal(render(), '<span>Balance: 0</span>');
  const saved = saveBalance('0.125');
  assert.equal(typeof saved.then, 'function');
  assert.equal(await saved, '0.125');
  assert.equal(render(), '<span>Balance: 0.125</span>');
  console.log('PASS React Redux mapper factories, own props, hooks, thunk arguments/results and removed exports');
}

async function expressContracts() {
  const express = require('express');
  const app = express();
  app.get('/files/*path', (request, response) => {
    assert.equal(request.param, undefined);
    response.status(200).json({ path: request.params.path });
  });
  app.get('/failure', async () => {
    throw new Error('fixture failure');
  });
  app.use((error, request, response, next) => response.status(503).json({ error: error.message }));
  const server = await new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', (error) => (error ? reject(error) : resolve(server)));
  });
  try {
    const url = 'http://127.0.0.1:' + server.address().port;
    assert.deepEqual(await (await fetch(url + '/files/one/two')).json(), { path: ['one', 'two'] });
    const failure = await fetch(url + '/failure');
    assert.equal(failure.status, 503);
    assert.deepEqual(await failure.json(), { error: 'fixture failure' });
    await new Promise((resolve, reject) => {
      app.listen(server.address().port, '127.0.0.1', (error) => {
        try {
          assert.equal(error.code, 'EADDRINUSE');
          resolve();
        } catch (failure) {
          reject(failure);
        }
      });
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
  console.log('PASS Express 5 async error forwarding, wildcard arrays, removed param API and listen errors');
}

async function main() {
  const prettier = require('prettier');
  const pending = prettier.format('const x=1', { parser: 'babel' });
  assert.equal(typeof pending.then, 'function');
  const text = await pending;
  assert.equal(await prettier.check(text, { parser: 'babel' }), true);
  const cursor = await prettier.formatWithCursor(text, { parser: 'babel', cursorOffset: 1 });
  assert.equal(typeof cursor.formatted, 'string');
  assert.equal(typeof cursor.cursorOffset, 'number');
  assert.equal(prettier.resolveConfig.sync, undefined);
  assert.equal(await prettier.clearConfigCache(), undefined);
  const classes = require('classnames');
  assert.equal(classes('one', ['two', [3, null]], { enabled: true, hidden: 0 }), 'one two 3 enabled');
  assert.equal(require('classnames/dedupe')('one', 'one'), 'one');
  assert.equal(require('classnames/bind').bind({ one: 'scoped' })('one'), 'scoped');
  assert.equal(typeof require('chalk').default.yellow.bold('test', 1), 'string');
  console.log('PASS Prettier asynchronous results and removed sync API, nested classnames and Chalk chaining');
  await storageContracts();
  await reduxContracts();
  await expressContracts();
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
