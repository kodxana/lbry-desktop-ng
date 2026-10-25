# Remaining dependency work

Inventory checked against the npm registry on 2026-10-24. The original catch-up
has changed 168 of 169 direct packages; the remaining original version is
localForage 1.10.0, which is still its latest release. This is a package count,
not a claim that the application is release-ready or that every dependency is
maintained. See [the baseline calculation](dependency-progress.md).

## Compatible refresh

This batch updates thirteen direct packages together:

| Package                | Previous | Current |
| ---------------------- | -------- | ------- |
| @babel/core            | 8.0.7    | 8.0.9   |
| @babel/runtime         | 8.0.7    | 8.0.8   |
| core-js                | 3.50.0   | 3.51.0  |
| electron-builder       | 26.17.0  | 26.18.0 |
| electron-updater       | 6.8.10   | 6.8.11  |
| eslint-plugin-n        | 18.4.1   | 18.5.0  |
| js-yaml                | 5.4.3    | 5.5.0   |
| node-html-parser       | 9.0.4    | 9.0.5   |
| postcss                | 8.5.29   | 8.5.31  |
| sass                   | 1.105.1  | 1.106.1 |
| typo-js                | 1.3.2    | 1.4.0   |
| webpack                | 5.111.1  | 5.112.2 |
| webpack-dev-middleware | 8.3.0    | 8.5.0   |

The update keeps the SDK, Electron, application version and profile paths fixed.
The Webpack declaration contract follows the new pin. Updater regressions now
cover recovery from invalid cached installer filenames, in addition to existing
checksum, consent, shutdown and legacy-client coverage.
That refresh also updated Typo.js to 1.4.0. The subsequent CodeMirror migration
removes the legacy spelling plugin and uses Typo.js directly.

unist-util-visit 5.2.0 was published on the inventory date and is held at 5.1.0
under Yarn's one-day release-age safeguard. Recheck it in the next maintenance
batch; do not disable the age gate to make a latest-version count look complete.

## Completed major migrations and maintenance

The [Video.js 10 migration](media-player.md) completes the last major player
replacement identified in this inventory. Video.js 8, quality-levels and the old
plugins are removed together. Playback and controls now use the supported React
components and HLS/DASH adapters, with native media integration.

The [CodeMirror 6 migration](markdown-editor.md) replaces EasyMDE, its React
wrapper and the old spelling plugin in both the Markdown editor and read-only
viewer. Original offline dictionary bytes, draft handling and editor controls
remain covered by the renderer tests.

The [ESLint migration](lint-tooling.md#eslint-10-compatibility) now runs 10.13.0
with import-x 4.17.1 and the official compatibility adapter for React/Flow rules.
Existing checks and warnings are preserved. The React/Flow peer declarations
still stop at ESLint 9; native plugin support remains maintenance work, and the
adapter is required until those plugins migrate.

The next maintenance batch moves Electron 44.9.3 to 45.0.0, including the
sandbox preload and asynchronous password-storage compatibility changes.
See [runtime migration](electron-runtime.md) for the changes and validation.
A registry recheck on October 25 found no other newer direct dependencies
except unist-util-visit 5.2.0, still within the one-day release-age safeguard.

## Build runtime and nested dependency refresh

The October 25 maintenance pass updates the build host from Node 24.21.0 to
[24.22.1](https://nodejs.org/en/blog/release/v24.22.1), an LTS security release.
CI and packaging both read `.node-version`. This changes the build host only:
Electron remains 45.0.0 with its own embedded Node 24.22.0, and the SDK pin is
unchanged.

Re-resolving the existing dependency ranges updates 79 nested package names
and removes 56 redundant locked versions. Direct application pins and custom
patches stay unchanged. Representative changes:

| Area                      | Nested updates                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| Compiler                  | Babel parser/types 7.29.11 and 8.0.8; block-scoping, classes and spread transforms 8.0.8 |
| Browser targets/polyfills | browserslist 4.29.4; core-js-compat and core-js-pure 3.51.0                              |
| Build and CSS             | schema-utils 4.8.1; postcss 8.5.31; postcss-selector-parser 7.1.7; source-map 0.7.6      |
| Downloads and packaging   | got 11.8.6; cacheable-request 7.0.4; Electron's extract-zip 1.0.6; node-abi 4.40.0       |
| Archives and documents    | jszip 3.10.2; sax 1.6.1; html-entities 2.6.0; dingbat-to-unicode 1.0.2                   |
| Certificates and metadata | asn1js 3.1.0; pkijs 3.4.3; tldts 7.4.19                                                  |

Every updated version satisfies its existing dependency range. The only major
version jumps are four TypeScript definition packages requested with wildcard
ranges (@types/estree, @types/ms, @types/node and @types/unist). They do not
change the Node runtime or replace the application's maintained Flow definitions.
The existing positive/negative type contracts remain required.

Yarn's 1,440-minute release-age gate and disabled lifecycle scripts remain in
effect. unist-util-visit stays at 5.1.0, including nested requests. The audit
still reports the same two advisories confined to the development-only legacy
updater fixture; the refresh adds none.

Validation uses the complete Windows/Linux desktop and installed Windows
upgrade workflows, including compilation, media decoding/quality controls,
documents, wallet backups/encryption, native password restart/migration,
updater consent/shutdown, packaged startup and development reloads.

## Release criteria

A candidate can close the initial catch-up only after its exact revision passes
the Windows and Linux desktop jobs and the installed Windows upgrade job. Those
jobs cover full Flow/lint, dependency contracts, document rendering, wallet
backup/encryption, saved-password migration and OS storage, update acceptance
and decline, SDK shutdown, packaged startup and development reloads.

After those gates, publish a Windows/Linux prerelease and collect real-use
feedback on account history, playback, downloads and documents. Automated tests
use disposable, unfunded profiles; they do not validate a funded wallet or
macOS. New releases published while qualifying a candidate belong to subsequent
maintenance unless they fix a relevant regression or security issue.

Passing these gates completes the planned catch-up, not ongoing maintenance.
Deprecation notices are maintenance work, not automatically security findings.
The old updater alias stays only as a development test client for RC1-RC3;
package checks must continue proving it is absent from the shipped application.
