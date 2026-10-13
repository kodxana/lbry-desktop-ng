/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const net = require('net');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');
const express = require('express');
const source = fs.readFileSync(path.join(__dirname, '../electron/devServer.js'), 'utf8');
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function portConflict(compiledFirst) {
  const occupied = net.createServer();
  await new Promise((resolve) => occupied.listen(0, 'localhost', resolve));
  const ready = [];
  const errors = [];
  let server;
  let onListen;
  const listened = new Promise((resolve) => {
    onListen = resolve;
  });
  const createApp = () => {
    const app = express();
    const listen = app.listen;
    app.listen = (...args) => {
      server = listen.apply(app, args);
      server.once('error', onListen);
      server.once('listening', onListen);
      return server;
    };
    return app;
  };
  createApp.static = express.static;
  const calls = { launches: 0, middlewareClosed: 0, compilersClosed: 0, hotClosed: 0 };
  const webpack = () => ({
    close: (callback) => {
      calls.compilersClosed++;
      callback();
    },
  });
  webpack.HotModuleReplacementPlugin = class {};
  const middleware = () => {
    const handler = (_req, _res, next) => next();
    handler.waitUntilValid = (callback) => ready.push(callback);
    handler.close = (callback) => {
      calls.middlewareClosed++;
      callback();
    };
    return handler;
  };
  const hot = (_req, _res, next) => next();
  hot.close = () => calls.hotClosed++;
  const state = { argv: ['node', 'devServer.js'], exitCode: 0, on: () => {} };
  const mocks = {
    '../config': { WEBPACK_ELECTRON_PORT: occupied.address().port },
    '../webpack.electron.config.js': [{}, {}],
    webpack,
    express: createApp,
    'webpack-dev-middleware': middleware,
    'webpack-hot-middleware': () => hot,
    child_process: {
      spawn: () => {
        calls.launches++;
        return new EventEmitter();
      },
    },
  };
  try {
    // Keep the real Express listener; only compilation and launching Electron are replaced.
    vm.runInNewContext(source, {
      require: (name) => (Object.prototype.hasOwnProperty.call(mocks, name) ? mocks[name] : require(name)),
      process: state,
      __dirname: path.resolve(__dirname, '../electron'),
      console: { log: () => {}, error: (error) => errors.push(error) },
    });
    if (!compiledFirst) await listened;
    ready.forEach((callback) => callback({ hasErrors: () => false }));
    await listened;
    await tick();
    assert.equal(state.exitCode, 1, 'An occupied development port must fail startup');
    assert(
      errors.some((error) => error.code === 'EADDRINUSE'),
      'Report the original listen error'
    );
    assert.deepEqual(calls, { launches: 0, middlewareClosed: 2, compilersClosed: 2, hotClosed: 1 });
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => occupied.close(resolve));
  }
}

(async () => {
  await portConflict(true);
  await portConflict(false);
  console.log(
    'PASS: occupied development port closes both compilers without launching Electron, before/after compilation'
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
