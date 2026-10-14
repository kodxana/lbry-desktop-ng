# Desktop compiler

The desktop uses Babel 7.29.7 with runtime helpers from 7.29.10 and the existing
Webpack 5 / babel-loader 10 pipeline. Compiler packages are pinned together;
the runtime helper version is also passed to `transform-runtime` so emitted
imports match the declared dependency. React Hot Loader is pinned to 4.13.1.

This batch keeps Babel 7's compilation behavior. Babel 8 is a separate migration:
it ships as ESM, removes `preset-env`'s `loose` option and changes React/Flow
defaults. See the [Babel migration guide](https://babeljs.io/docs/v8-migration).
The classic React JSX runtime, existing loose preset transforms and strict
public/private class field transforms remain explicit. The Video.js override
still preserves native classes. In the existing configuration, type-only Flow
fields become own properties initialized to `undefined`; the regression fixture
checks that behavior rather than silently changing component initialization.

Deprecated class/private-field proposal plugins are replaced by their supported
transform equivalents. These plugins and the CommonJS transform used by tests
are now direct dependencies. Decorators, glob imports, add-module-exports and
the older object-spread/import transforms had no callers and were removed.
The dynamic-import syntax plugin is unnecessary with the current Babel parser;
Webpack still receives ESM and dynamic imports for lazy chunks.

`@babel/polyfill` is replaced at all three entry points by `core-js/stable` 3.50.0
and `regenerator-runtime/runtime` 0.14.1, following the
[Babel polyfill guidance](https://babeljs.io/docs/babel-polyfill). Stable global
APIs and the generator runtime remain available to legacy compiled dependencies.
The renderer and sandbox fixtures load the same polyfills as the application.
This does not remove every transitive core-js 2 dependency from the older UI stack.

`node build/testCompiler.js` checks both production and development compilation:
Flow fields, React JSX, field descriptors and private brands, async error
propagation/generators, object spread, native player inheritance, lazy imports
and custom-hook hot-loader registration. The core semantic checks were run
against the previous compiler before upgrading. The suite also launches the
standalone sandbox script through `@babel/register`, with explicit CommonJS
conversion and the module's default export. It runs in the desktop regression
suite.

Windows/Linux CI also builds and launches both packaged and development apps,
exercises the real renderer and sandbox, tests wallet ZIP/encrypted backup
restoration and OS password storage, and validates updater consent and shutdown.
Actual installed Windows upgrades run only on fresh hosted runners with
disposable, unfunded wallets.
