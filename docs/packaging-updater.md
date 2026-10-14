# Packaging and updater migration

The build now pins electron-builder 26.17.0, electron-updater 6.8.10 and the
host-side archive reader @electron/asar 4.3.1. These use the stable v26 release
line; the v27/updater v7 prereleases are a separate migration. React, the SDK
candidate and the application version are unchanged. The subsequent
[runtime migration](electron-runtime.md) moves Electron from 17.2.0 to 44.7.0.
Published RC3 packages still contain the old dependencies.

Upstream changes reviewed:

- [Builder 26.17.0 changelog](https://github.com/electron-userland/electron-builder/blob/v26.17.0/packages/app-builder-lib/CHANGELOG.md)
- [Updater 6.8.10 changelog](https://github.com/electron-userland/electron-builder/blob/electron-updater%406.8.10/packages/electron-updater/CHANGELOG.md)

## Compatibility changes

- Packaging runs through the checked-in Yarn's `exec` command so the builder's
  dependency collector can query Yarn without requiring a global installation.
  Missing production dependencies now fail the build. Electron's development
  package is explicitly excluded: the new collector otherwise includes the
  peer of `@electron/remote`, duplicating Electron inside the application.
- `detectUpdateChannel: false` preserves `latest.yml` on prereleases, and
  `electronUpdaterCompatibility: ">=4.6.5"` keeps metadata readable by RC1-RC3.
  The updater 4.6.5 alias is a development-only compatibility client.
- Updater 6 normally keeps an installed RC on its prerelease channel. The small
  custom GitHub provider compares that result with the newest stable release,
  so an RC can graduate to stable without changing user preferences. Repositories
  with only RCs, or with no RC left in the feed, also work. URL resolution,
  parsing, caching, checksums and download handling remain upstream code.
- The provider's upstream import remains external in Webpack, alongside the
  updater, so its HTTP error types match the running updater's types. This is
  necessary for fallback from a missing `rc.yml` to `latest.yml`.
- Full NSIS installers remain the Windows format; web installers are explicitly
  disabled. Downloading does not imply permission to install. SDK shutdown must
  finish cleanly before `quitAndInstall(false, true)`; ordinary app exit never
  installs an update.
- Electron 44 builds require Windows 10 or later. NSIS rejects unsupported
  systems before replacing files, including updates from RC1–RC3. Those older
  clients can still offer/download an update; rejection happens at installation.
  Package tests run a harmless compiled fixture through supported, unsupported
  and native OS checks. The portable test ZIP has no installer guard.
- The renderer uses the scoped `desktop-updater` IPC commands for status, release
  preferences, checking, accepting and declining. It no longer loads
  `electron-updater` or attaches callbacks through `@electron/remote`. The main
  process sends plain status snapshots, including consent and download progress
  on its original 0-100 scale. Snapshot revisions prevent a delayed initial reply
  from overwriting a newer event. A renderer reload recovers the current choice;
  a full application restart starts a new session without install consent.
- Declining an update is acknowledged before the prompt closes. A completed
  background download cannot undo that choice. Users can explicitly accept the
  cached update later. Download and shutdown failures allow an explicit retry;
  changing the candidate during shutdown prevents installation.
- Package inspection uses the maintained `@electron/asar` package. The unused
  legacy notarization dependency and disabled hook are removed. Windows signing
  options remain unchanged; macOS signing/notarization is not validated here.

## Validation

Updater diagnostics use `electron-log` 5.4.4 through its Node entry point. The
app needs no renderer logging, so it does not load the Electron entry point's
IPC handlers or initialize a logging preload. The file transport uses the v5
`resolvePathFn` option to retain the selected profile's `logs/main.log`, including
existing content and the default 1 MiB rotation to `main.old.log`. No remote
transport or automatic exception capture is enabled. See the upstream
[v4-to-v5 migration guide](https://github.com/megahertz/electron-log/blob/v5.4.4/docs/migration.md).
Updater tests use the real logger, checking formatting, append, rotation,
profile isolation and a non-writable destination. These run in Node and Electron;
packaged/development tests verify that no logging bridge appears in the renderer.
The hosted installed-upgrade test carries an RC3 log through both updates and
verifies that the new app appends to it in the same profile.

The app's direct `semver` dependency is pinned to 7.8.5, replacing 5.7.1.
The updater and hub handshake retain the existing minimum-version, prerelease
and downgrade rules. Version 7 trims surrounding whitespace during validation;
the callers explicitly reject it to preserve strict handling of remote versions.
The app uses only `valid`, `gt`, `lt` and `prerelease`, so the intervening changes
to range parsing and coercion do not affect these callers. See the
[upstream changelog](https://github.com/npm/node-semver/blob/v7.8.5/CHANGELOG.md).
Dependencies retain their own compatible semver versions; there is no global
resolution override.

`node build/testDesktopUpdates.js` runs genuine NSIS updaters 6.8.10 and 4.6.5
against a local HTTP fixture. It covers RC/stable selection, prerelease opt-out,
newer stable releases, RC-only repositories, missing releases, corrupt and
interrupted downloads, retry, cache reuse across updater instances and recovery
from a corrupted cached installer. The new updater also exercises full-download
fallback after a missing blockmap. Fixture payloads are inert text.
Version-policy cases cover numeric RC ordering, graduation to stable, build
metadata equality and malformed versions that must not trigger a download or
installation. `node build/testDesktopSetup.js` checks protocol boundaries and
malformed versions over a real local TCP handshake before requesting hub features.

`node build/testRenderer.js` repeats these checks inside Electron's embedded
runtime. The real new updater's `quitAndInstall` path is exercised after a
delayed SDK-shutdown callback, including duplicate acceptance and restart flags;
only the final installer launch and app quit are intercepted. Existing tests
cover failed SDK shutdown, cancellation and update consent.

`node build/testUpdaterIpc.js` checks command validation, sender restrictions,
duplicate requests, progress values, delayed checks/downloads and SDK shutdown
failures. The renderer suite also exercises the real connected update modal,
Redux and IPC: install/decline controls, failed decline acknowledgement, retries,
late snapshots, listener cleanup and restoring a declined update in a new renderer.
Packaged and development smoke tests check the production IPC registration and
confirm that startup never supplies install consent. The remaining application
features and test harness have now also moved off `@electron/remote`.

After packaging, `node build/testDesktopPackage.js` checks the archive, updater
version, SDK pin and asset digests. It rejects bundled development tools, a second
Electron runtime and the legacy test updater. On Windows, both updater versions
must discover the actual generated `latest.yml` through the GitHub provider,
including prerelease-channel fallback. No release is published by these tests.

The Windows/Linux CI matrix also runs saved-state, document, file-selection,
password-migration, wallet backup/encryption and real SDK isolation checks,
followed by packaged and development app startup/sync/shutdown smoke tests.
Linux updates remain manual. Builds are unsigned. Native old-to-new installer
execution and real profile persistence through installation still require the
disposable-profile release acceptance described in [the release guide](desktop-ng-releases.md).
