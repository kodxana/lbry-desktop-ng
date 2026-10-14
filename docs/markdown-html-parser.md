# Markdown HTML parser dependency

The desktop pins node-html-parser 9.0.4, upgraded from 5.3.3. Its only application
call site extracts the source from legacy LBRY iframe markup in Markdown. A
`lbry://` source is passed to the existing Markdown link pipeline. Parsed HTML is
never inserted into the page; the remark sanitizer still handles rendered output.

## Compatibility

The [upstream changelog](https://github.com/taoqf/node-html-parser/blob/v9.0.4/CHANGELOG.md)
records changes to module packaging, entity decoding and parsing behavior. The
package now exposes explicit ESM and CommonJS entry points; the renderer keeps
its named `parse` import. Its `parse`, `getElementsByTagName` and `getAttribute`
calls remain supported, so no application API adapter is needed.

The decoder changes from `he` to `entities`, and the selector dependencies move
to newer versions. The lockfile records those transitive changes. Modern syntax
and dependency requirements are supported by the pinned Node 24 build host and
Electron 44 runtime.

This migration preserves the existing rules for recognizing legacy embed markup.
It does not broaden iframe support or change the remark/React versions.

## Validation

`build/tests/markdown.jsx` runs through the real Markdown component as part of
`node build/testRenderer.js`. It checks both quote styles, numeric and named
entities, Unicode names, claim IDs, whitespace, additional attributes, multiple
embeds and surrounding text. External, local, active and incomplete iframe
sources must not create live frames. The offline preview uses the production
parser and remark pipeline without requesting claim resolution. The renderer
harness rejects unexpected network requests.

The existing document, sandbox, media, wallet, password and updater regressions
remain required. Windows/Linux CI also restores encrypted backups with the real
SDK, verifies native password storage, builds packages and checks application
startup/shutdown. Hosted Windows CI exercises actual installed updates with
disposable, unfunded wallets and checks preserved keys, saved passwords and
application storage. No macOS coverage is provided by this matrix.
