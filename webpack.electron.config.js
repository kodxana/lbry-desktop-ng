// Load desktop defaults before resolving aliases and preprocess-loader conditions.
require('./config');
const path = require('path');
const webpack = require('webpack');
const { merge } = require('webpack-merge');
const baseConfig = require('./webpack.base.config.js');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { DefinePlugin, ProvidePlugin } = require('webpack');

const STATIC_ROOT = path.resolve(__dirname, 'static/');
const DIST_ROOT = path.resolve(__dirname, 'dist/');

const desktopSettings = path.resolve(
  __dirname,
  process.env.LBRY_DESKTOP_BUILD === 'sdk-test' ? 'sdk-test.json' : 'desktop-settings.json'
);

const mainConfig = {
  target: 'electron-main',
  entry: {
    main: './electron/index.js',
    preload: './electron/preload.cjs',
  },
  output: {
    filename: '[name].js',
    path: path.join(DIST_ROOT, 'electron/webpack'),
    publicPath: '',
  },
  module: {
    rules: [
      { test: /\.cjs$/, type: 'javascript/auto' },
      {
        test: /\.(jsx?$|s?css$)/,
        use: [
          {
            loader: 'preprocess-loader',
            options: {
              TARGET: 'app',
              ppOptions: {
                type: 'js',
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new webpack.NormalModuleReplacementPlugin(/desktop-settings\.json$/, desktopSettings),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'node_modules/font-awesome/README.md'),
          to: `${DIST_ROOT}/electron/static/licenses/font-awesome-README.md`,
        },
        {
          from: path.resolve(__dirname, 'node_modules/codemirror-spell-checker/LICENSE'),
          to: `${DIST_ROOT}/electron/static/licenses/codemirror-spell-checker.LICENSE`,
        },
        {
          from: path.resolve(__dirname, 'ui/util/electron-cookies.LICENSE'),
          to: `${DIST_ROOT}/electron/static/licenses/electron-cookies.LICENSE`,
        },
        {
          from: `${STATIC_ROOT}/`,
          to: `${DIST_ROOT}/electron/static/`,
          globOptions: {
            ignore: ['index-web.html', 'index-electron.html', 'daemon/**/*'],
          },
        },
        {
          from: `${STATIC_ROOT}/index-electron.html`,
          to: `${DIST_ROOT}/electron/static/index.html`,
        },
        {
          from: `${STATIC_ROOT}/daemon`,
          to: `${DIST_ROOT}/electron/daemon`,
        },
      ],
    }),
  ],
  externals: {
    electron: 'commonjs electron',
    express: 'commonjs express',
    'electron-updater': 'commonjs electron-updater',
    'electron-updater/out/providers/GitHubProvider': 'commonjs electron-updater/out/providers/GitHubProvider',
  },
};

const plugins = [
  new webpack.NormalModuleReplacementPlugin(/desktop-settings\.json$/, desktopSettings),
  new DefinePlugin({
    IS_WEB: JSON.stringify(false),
  }),
  new ProvidePlugin({
    __: ['i18n.js', '__'],
  }),
];

const renderConfig = {
  target: 'web',
  resolve: {
    alias: { config: path.resolve(__dirname, 'configValues.js') },
    fallback: {
      path: require.resolve('path-browserify'),
      url: require.resolve('url/'),
      util: require.resolve('util/'),
      buffer: require.resolve('buffer/'),
      stream: require.resolve('stream-browserify'),
      assert: require.resolve('assert/'),
    },
  },
  entry: {
    ui: ['./ui/index.jsx'],
  },
  output: {
    filename: '[name].js',
    path: path.join(DIST_ROOT, 'electron/webpack'),
    publicPath: '',
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: [
          {
            loader: 'preprocess-loader',
            options: {
              TARGET: 'app',
              ppOptions: {
                type: 'js',
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    ...plugins,
    new ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: require.resolve('process/browser.js'),
      'global.process': require.resolve('process/browser.js'),
    }),
    new DefinePlugin({
      'process.platform': 'window.lbryDesktop.platform',
      'process.env.APPIMAGE': '(window.lbryDesktop.appImage ? "AppImage" : undefined)',
      'process.env': '{}',
    }),
  ],
};

module.exports = [merge(baseConfig, mainConfig), merge(baseConfig, renderConfig)];
