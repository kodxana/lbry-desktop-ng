# Desktop compiler

The desktop uses Babel 8.0.7 with runtime helpers from 8.0.7 and the existing
Webpack 5 / babel-loader 10 pipeline. The 12 direct Babel dependencies are pinned
to compatible stable 8.x versions. The runtime helper version is also passed to
`transform-runtime` so emitted imports match the declared dependency. Babel's
ESM packages run under the pinned Node 24 runtime; CommonJS callers use its ESM
interop, including the default export of `@babel/register`.

The [Babel migration guide](https://babeljs.io/docs/v8-migration) describes the
removed preset options and changed defaults. Our configuration explicitly keeps
the previous browser target range, classic React JSX and production JSX metadata
behavior in both build modes. Named assumptions replace `preset-env`'s `loose`
option, with strict public/private fields kept separately: fields must not call
inherited setters, and private members must remain hidden and brand-checked.
The Video.js override still preserves native classes. Type-only Flow fields
continue to become own properties initialized to `undefined`.

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
Flow fields, React JSX spread precedence and keys, field descriptors and private
brands, async error propagation/generators, object spread, native player
inheritance and lazy imports. Fast Refresh registration is restricted to UI
modules in development. These semantic checks passed on Babel 7 with both the
old configuration and the replacement assumptions before the upgrade. The suite
also loads the devtools installer through `@babel/register`, with explicit
CommonJS conversion. It runs in the desktop regression suite.

The setup/startup fixtures that compile without the project configuration also
select classic JSX explicitly. Real renderer tests exercise document/media
components, sandboxing and Electron's use of Babel for cached devtools loading.
The development-app smoke test checks state-preserving Fast Refresh. Babel 7 may
still be present transitively for dependencies that declare it; those are not
forced onto Babel 8 through resolutions.

Windows/Linux CI also builds and launches both packaged and development apps,
exercises the real renderer and sandbox, tests wallet ZIP/encrypted backup
restoration and OS password storage, and validates updater consent and shutdown.
Actual installed Windows upgrades run only on fresh hosted runners with
disposable, unfunded wallets.
