const path = require('path');
const webpack = require('webpack');
const Dotenv = require('dotenv-webpack');
const { DefinePlugin } = require('webpack');
const { getIfUtils } = require('webpack-config-utils');
const TerserPlugin = require('terser-webpack-plugin');

const NODE_ENV = process.env.NODE_ENV || 'development';
const { ifProduction } = getIfUtils(NODE_ENV);
const UI_ROOT = path.resolve(__dirname, 'ui/');

let baseConfig = {
  mode: ifProduction('production', 'development'),
  devtool: ifProduction('source-map', 'eval-cheap-module-source-map'),
  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true,
      }),
    ],
  },
  node: {
    __dirname: false,
  },
  module: {
    rules: [
      {
        test: /[\\/]node_modules[\\/]villain-react[\\/]dist[\\/]villain\.js$/,
        resolve: { alias: { 'reakit$': path.resolve(__dirname, 'ui/util/villain-reakit.js') } },
      },
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
      },
      {
        test: /\.s?css$/,
        use: [
          { loader: 'style-loader' },
          { loader: 'css-loader' },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                // The desktop has always supplied its own plugins; do not also
                // load the unrelated root postcss.config.js after upgrading.
                config: false,
                plugins: [require('postcss-rtl')()],
              },
            },
          },
          { loader: 'sass-loader', options: { implementation: require('sass') } },
        ],
      },
      {
        test: /\.(png|svg|gif)$/,
        type: 'asset/resource',
        generator: { filename: 'img/[name][ext]' },
      },
      {
        test: /\.(vert|frag|glsl)$/,
        type: 'asset/source',
      },
    ],
  },
  // Allows imports for all directories inside '/ui' :)
  resolve: {
    modules: [UI_ROOT, 'node_modules', __dirname],
    extensions: ['.js', '.jsx', '.json', '.scss'],
    alias: {
      config: path.resolve(__dirname, 'config.js'),
      homepage: 'util/homepage.js',
      homepages:
        process.env.CUSTOM_HOMEPAGE === 'true'
          ? path.resolve(__dirname, 'custom/homepages/v2/index.js')
          : 'homepages/index.js',
      memes:
        process.env.CUSTOM_HOMEPAGE === 'true'
          ? path.resolve(__dirname, 'custom/homepages/meme/index.js')
          : path.resolve(__dirname, 'homepages/meme/index.js'),
      lbryinc: 'extras/lbryinc',
      recsys: 'extras/recsys',
      // React 17 provides this runtime without an exports map for ESM callers.
      'react/jsx-runtime$': require.resolve('react/jsx-runtime.js'),
      // Use the filter transform's ES module entry. Its Lodash subpaths also
      // have CommonJS callers, so they must retain their native export shape.
      'redux-persist-transform-filter': 'redux-persist-transform-filter/index.js',
    },
    symlinks: false,
  },

  plugins: [
    new webpack.IgnorePlugin({ resourceRegExp: /^\.\/locale$/, contextRegExp: /moment$/ }),
    new webpack.EnvironmentPlugin(['NODE_ENV']),
    new DefinePlugin({
      __static: `"${path.join(__dirname, 'static').replace(/\\/g, '\\\\')}"`,
      'process.env.NODE_ENV': JSON.stringify(NODE_ENV),
      'process.env.LBRY_API_URL': JSON.stringify(process.env.LBRY_API_URL),
      'process.env.SENTRY_AUTH_TOKEN': JSON.stringify(process.env.SENTRY_AUTH_TOKEN),
      'process.env.MOONPAY_SECRET_KEY': JSON.stringify(process.env.MOONPAY_SECRET_KEY),
    }),
    new Dotenv({
      // Electron's renderer has a real process.env; the browser stub breaks
      // runtime checks such as electron-is-dev's `in process.env` lookup.
      ignoreStub: true,
      allowEmptyValues: true, // allow empty variables (e.g. `FOO=`) (treat it as empty string, rather than missing)
      systemvars: true, // load all the predefined 'process.env' variables which will trump anything local per dotenv specs.
      silent: false, // hide any errors
      defaults: true, // load '.env.defaults' as the default values if empty.
    }),
  ],
};
module.exports = baseConfig;
