# Persistence and conditional-build dependencies

The desktop replaces redux-persist-transform-compress 4.2.0 and preprocess-loader
0.3.0 with small application adapters. lz-string moves from 1.4.4 to the stable
1.5.0 release. json-stringify-safe 5.0.1, already used by the old compressor,
becomes an explicit dependency so circular-value handling stays the same.

## Saved-state compatibility

The compressor still writes JSON encoded with LZ UTF-16 compression, in the same
transform order and under the same `persist:v0` key. Non-string input on rehydration
passes through, malformed compressed JSON returns null, and serialization errors
still propagate. Existing filters continue to exclude balances, sync completion,
unsent transactions, account state and passwords.

The golden fixture records 15 synthetic cases produced by the old libraries
before removal. Tests require identical compressed bytes for ordinary objects,
Unicode and unpaired surrogates, empty/null/undefined values, nonfinite numbers,
dates, shared references and cycles. They also decode the independent published
RC preference fixture. This keeps the format readable by existing versions.

localForage remains pinned at 1.10.0, its current stable release. The IndexedDB
database/store names, localStorage fallback and storage-driver selection do not
change. Replacing that engine would require a separate migration and failure
recovery design; a higher dependency percentage alone does not justify it.
See the [upstream releases](https://github.com/localForage/localForage/releases).

## Conditional builds

The local Webpack 5 loader uses `getOptions()` and supports the source directives
used by this app: standalone JS or JSX comment lines with `@if`, `@else` and
`@endif`. Conditions accept dotted context names and quoted equality checks.
Directive names are case-insensitive, including the existing uppercase
`@ENDIF` in download notification handling. Nested conditions retain their
parent branch. Removed lines remain blank so Babel source locations are retained.

Build context is limited to TARGET and CUSTOM_HOMEPAGE. The old
`process.env.DEBUG_TILE_RENDER` directive remains false: the previous loader
passed a flat environment object, not a nested process object. No expression
evaluation, file inclusion or command execution is supported. Unsupported
preprocessor operations and unbalanced branches fail the build. Ordinary comments,
Flow annotations and Sass directives remain unchanged.

The loader runs on application sources, not third-party modules. Before removing
the old engine, both implementations were compared after Flow/JSX compilation
for all 43 affected modules, with app/web targets and custom homepage on/off:
172 comparisons produced identical compiled output. This is a compiler comparison;
it does not establish that the separate web application builds.

Removing the wrapper also removes preprocess 3.2.0, xregexp 3.1.0,
loader-utils 1.4.0 and their now-unused dependency entries.

## Validation

- `node build/testPersistenceBuild.js` checks codec compatibility, published RC
  state, error behavior, nested/JSX directives, line locations, malformed input,
  Webpack options and every current source directive.
- Full Flow and dependency contracts check the new codec declarations, including
  nullable decompression and undefined JSON serialization results.
- The renderer suite still exercises real IndexedDB rehydration, filtered writes,
  playback history, collections, wallet forms, password migration and updater IPC.
- Windows/Linux CI checks OS password storage, encrypted SDK backup restoration,
  production/development startup and packaged update metadata. The installed
  Windows upgrade checks published RC3 to candidate and candidate to candidate
  while retaining the test wallet, saved passwords and compressed preferences.

Fixtures use disposable profiles and unfunded wallets. macOS, funded transactions
and a replacement storage engine are outside this batch.
