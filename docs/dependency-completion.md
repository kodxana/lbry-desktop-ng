# Remaining dependency work

Inventory checked against the npm registry on 2026-10-24. The original catch-up
has changed 168 of 169 direct packages; the remaining original version is
localForage 1.10.0, which is still its latest release. This is a package count,
not a claim that the application is release-ready or that every dependency is
maintained. See [the baseline calculation](dependency-progress.md).

## Compatible refresh

This batch updates thirteen direct packages together:

| Package | Previous | Current |
| --- | --- | --- |
| @babel/core | 8.0.7 | 8.0.9 |
| @babel/runtime | 8.0.7 | 8.0.8 |
| core-js | 3.50.0 | 3.51.0 |
| electron-builder | 26.17.0 | 26.18.0 |
| electron-updater | 6.8.10 | 6.8.11 |
| eslint-plugin-n | 18.4.1 | 18.5.0 |
| js-yaml | 5.4.3 | 5.5.0 |
| node-html-parser | 9.0.4 | 9.0.5 |
| postcss | 8.5.29 | 8.5.31 |
| sass | 1.105.1 | 1.106.1 |
| typo-js | 1.3.2 | 1.4.0 |
| webpack | 5.111.1 | 5.112.2 |
| webpack-dev-middleware | 8.3.0 | 8.5.0 |

The update keeps the SDK, Electron, application version and profile paths fixed.
The Webpack declaration contract follows the new pin. Updater regressions now
cover recovery from invalid cached installer filenames, in addition to existing
checksum, consent, shutdown and legacy-client coverage.
That refresh also updated Typo.js to 1.4.0. The subsequent CodeMirror migration
removes the legacy spelling plugin and uses Typo.js directly.

unist-util-visit 5.2.0 was published on the inventory date and is held at 5.1.0
under Yarn's one-day release-age safeguard. Recheck it in the next maintenance
batch; do not disable the age gate to make a latest-version count look complete.

## Remaining major migrations

These are application or tooling migrations, not safe package-pin substitutions.
They remain open work rather than being counted as completed by the refresh.

| Area | Current / available | Why it needs its own migration |
| --- | --- | --- |
| Media player | Video.js 8.24.1 / 10.2.0 | videojs-contrib-quality-levels 4.1.0 declares Video.js 8. Migrate the player and quality integration together, with playback, seeking, captions, source changes and cleanup coverage. |

The [CodeMirror 6 migration](markdown-editor.md) replaces EasyMDE, its React
wrapper and the old spelling plugin in both the Markdown editor and read-only
viewer. Original offline dictionary bytes, draft handling and editor controls
remain covered by the renderer tests.

The [ESLint migration](lint-tooling.md#eslint-10-compatibility) now runs 10.13.0
with import-x 4.17.1 and the official compatibility adapter for React/Flow rules.
Existing checks and warnings are preserved. The React/Flow peer declarations
still stop at ESLint 9; native plugin support remains maintenance work, and the
adapter is required until those plugins migrate.

Electron 45.0.0 is also available. The current patched 44.9.3 remains within
Electron's [latest-three-stable-major support policy](https://www.electronjs.org/docs/latest/tutorial/electron-timelines).
Treat 45 as the next supported-runtime upgrade, with the same isolation,
password, backup and installer checks, rather than combining it with editor or
player changes.

The constraints above come from the published manifests for
[quality levels](https://registry.npmjs.org/videojs-contrib-quality-levels/4.1.0).

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

Keep the major migrations above visible when describing completion. A released
catch-up candidate does not mean those migrations are finished. Likewise,
deprecation notices are maintenance work, not automatically security findings.
The old updater alias stays only as a development test client for RC1-RC3;
package checks must continue proving it is absent from the shipped application.
