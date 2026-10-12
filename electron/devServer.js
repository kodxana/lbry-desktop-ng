/* eslint-disable no-console */
const { WEBPACK_ELECTRON_PORT } = require('../config');
const chalk = require('chalk');
const webpack = require('webpack');
const { merge } = require('webpack-merge');
const middleware = require('webpack-dev-middleware');
const express = require('express');
const path = require('path');
const app = express();
const { spawn } = require('child_process');

console.log(
  chalk.magenta(`Compiling ${chalk.underline('main')} and ${chalk.underline('render')}, this will take a while.`)
);

let [mainConfig, renderConfig] = require('../webpack.electron.config.js');

renderConfig = merge(renderConfig, {
  entry: { ui: ['webpack-hot-middleware/client'] },
  plugins: [new webpack.HotModuleReplacementPlugin()],
  resolve: {
    alias: { 'react-dom': '@hot-loader/react-dom' },
    symlinks: false,
  },
});

const mainCompiler = webpack(mainConfig);
const mainInstance = middleware(mainCompiler, {
  stats: 'errors-warnings',
  writeToDisk: true,
});

const renderCompiler = webpack(renderConfig);
const renderInstance = middleware(renderCompiler, {
  stats: 'errors-warnings',
  publicPath: '/',
});
const hotMiddleware = require('webpack-hot-middleware')(renderCompiler);
app.use(hotMiddleware);
app.use(renderInstance);
app.use(express.static('dist/electron/static'));

const server = app.listen(Number(WEBPACK_ELECTRON_PORT), 'localhost', () => {
  console.log(chalk.yellow.bold(`Renderer listening on port ${WEBPACK_ELECTRON_PORT} (still compiling)`));
});

const ready = (instance) => new Promise((resolve) => instance.waitUntilValid(resolve));
let closing = false;
function close() {
  if (closing) return;
  closing = true;
  hotMiddleware.close();
  server.close();
  mainInstance.close(() => mainCompiler.close(() => {}));
  renderInstance.close(() => renderCompiler.close(() => {}));
}

Promise.all([ready(mainInstance), ready(renderInstance)]).then((stats) => {
  if (stats.some((result) => result.hasErrors())) {
    process.exitCode = 1;
    close();
    return;
  }
  console.log(chalk.yellow('Spawning electron...'));

  const electron = require('electron');
  // Launch the application directory so Electron reads its name and version.
  const child = spawn(electron, [path.resolve(__dirname, '..'), ...process.argv.slice(2)], {
    stdio: 'inherit',
    windowsHide: true,
  });
  child.on('error', (error) => {
    console.error(error);
    process.exitCode = 1;
    close();
  });
  child.on('exit', (code) => {
    process.exitCode = code || 0;
    close();
  });

  process.on('SIGINT', () => {
    console.log('Killing threads...');

    child.kill('SIGINT');
    close();
  });
});
/* eslint-enable no-console */
