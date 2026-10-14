module.exports = (api) => {
  api.cache(false);

  return {
    presets: [
      ['@babel/env', { loose: true, modules: false }],
      ['@babel/react', { runtime: 'classic' }],
      '@babel/flow',
    ],
    overrides: [
      {
        // Video.js 8 components are native classes. Transpiled constructors
        // cannot call their superclasses without `new`.
        test: /[\\/]ui[\\/]component[\\/]viewers[\\/]videoViewer[\\/]internal[\\/]/,
        presets: [['@babel/env', { loose: true, modules: false, exclude: ['@babel/transform-classes'] }]],
      },
    ],
    plugins: [
      ['@babel/plugin-transform-runtime', { version: require('./package.json').dependencies['@babel/runtime'] }],
      ['@babel/plugin-transform-private-methods', { loose: false }],
      ['@babel/plugin-transform-private-property-in-object', { loose: false }],
      '@babel/plugin-transform-flow-strip-types',
      ['@babel/plugin-transform-class-properties', { loose: false }],
      'react-hot-loader/babel',
    ],
    ignore: [/node_modules/],
  };
};
