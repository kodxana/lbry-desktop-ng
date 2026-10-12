const path = require('path');
const [, renderer] = require('../../webpack.electron.config');

// Exercise the desktop's real loader order, aliases and production React build.
module.exports = {
  ...renderer,
  entry: './build/tests/renderer.jsx',
  output: { path: path.resolve(__dirname, '../../dist/renderer-tests'), filename: 'renderer.js' },
  devtool: false,
  optimization: { minimize: false },
};
