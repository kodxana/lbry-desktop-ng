require('@babel/register')({ plugins: ['@babel/plugin-transform-modules-commonjs'] });
require('core-js/stable');
require('regenerator-runtime/runtime');

require('./startSandbox.js').default();
