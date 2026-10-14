require('@babel/register')({ plugins: ['@babel/plugin-transform-modules-commonjs'] });
require('assert').strict.equal(typeof require('../../electron/installDevtools.js').default, 'function');
