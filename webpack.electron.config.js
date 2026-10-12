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

// if (hasSentryToken) {
//   plugins.push(
//     new SentryWebpackPlugin({
//       include: './dist',
//       ignoreFile: '.sentrycliignore',
//       ignore: ['node_modules', 'webpack.config.js', 'webworkers'],
//       configFile: 'sentry.properties',
//     })
//   );
// }

const renderConfig = {
  target: 'electron-renderer',
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
  plugins,
};

module.exports = [merge(baseConfig, mainConfig), merge(baseConfig, renderConfig)];
