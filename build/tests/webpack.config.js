const path = require('path');
// The purchase integration tests sign locally with a synthetic key, never user configuration.
process.env.MOONPAY_SECRET_KEY = 'fixture-moonpay-key';
const [, renderer] = require('../../webpack.electron.config');

// Exercise the desktop's real loader order, aliases and production React build.
const fixture = {
  ...renderer,
  entry: './build/tests/renderer.jsx',
  output: { ...renderer.output, path: path.resolve(__dirname, '../../dist/renderer-tests'), filename: 'renderer.js' },
  devtool: false,
  optimization: { minimize: false },
  // Test code may create disposable fixtures; application imports still use the
  // production browser build. The separate sandbox suite has no Node externals.
  externals: [
    ({ context, request }, callback) => {
      const native = ['assert', 'buffer', 'fs', 'path', 'url', 'stream', 'adm-zip', 'electron'];
      if (context.startsWith(__dirname) && native.includes(request)) return callback(null, 'commonjs ' + request);
      callback();
    },
  ],
};
module.exports = [
  {
    mode: 'production',
    target: 'electron-preload',
    entry: { preload: './electron/preload.cjs', 'fixture-preload': './build/tests/preload.cjs' },
    output: { path: fixture.output.path, filename: '[name].js' },
  },
  fixture,
  {
    ...renderer,
    entry: './build/tests/sandboxDependencies.js',
    output: { ...fixture.output, filename: 'sandbox-dependencies.js' },
    devtool: false,
    optimization: { minimize: false },
  },
];
