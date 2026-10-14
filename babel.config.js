module.exports = (api) => {
  api.cache(false);

  return {
    targets: '>= 0%',
    // Preserve preset-env's former loose transforms, while keeping public
    // fields as descriptors and private fields/methods hidden from reflection.
    assumptions: {
      arrayLikeIsIterable: true,
      constantReexports: true,
      ignoreFunctionLength: true,
      ignoreToPrimitiveHint: true,
      mutableTemplateObject: true,
      noClassCalls: true,
      noDocumentAll: true,
      objectRestNoSymbols: true,
      pureGetters: true,
      setClassMethods: true,
      setComputedProperties: true,
      setSpreadProperties: true,
      skipForOfIteratorClosing: true,
      superIsCallableConstructor: true,
      setPublicClassFields: false,
      privateFieldsAsProperties: false,
    },
    presets: [
      ['@babel/env', { modules: false, exclude: ['@babel/transform-typeof-symbol'] }],
      ['@babel/react', { runtime: 'classic', development: false }],
      '@babel/flow',
    ],
    overrides: [
      {
        test: /[\\/]ui[\\/]/,
        plugins: process.env.NODE_ENV === 'development' ? ['react-refresh/babel'] : [],
      },
      {
        // Video.js 8 components are native classes. Transpiled constructors
        // cannot call their superclasses without `new`.
        test: /[\\/]ui[\\/]component[\\/]viewers[\\/]videoViewer[\\/]internal[\\/]/,
        presets: [
          ['@babel/env', { modules: false, exclude: ['@babel/transform-classes', '@babel/transform-typeof-symbol'] }],
        ],
      },
    ],
    plugins: [
      ['@babel/plugin-transform-runtime', { version: require('./package.json').dependencies['@babel/runtime'] }],
      '@babel/plugin-transform-private-methods',
      '@babel/plugin-transform-private-property-in-object',
      '@babel/plugin-transform-flow-strip-types',
      '@babel/plugin-transform-class-properties',
    ],
    ignore: [/node_modules/],
  };
};
