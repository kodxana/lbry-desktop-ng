# Packaging and updater migration

The build now pins electron-builder 26.17.0, electron-updater 6.8.10 and the
host-side archive reader @electron/asar 4.3.1. These use the stable v26 release
line; the v27/updater v7 prereleases are a separate migration. Electron 17.2.0,
React, the SDK candidate and the application version are unchanged. Published
RC3 packages still contain the old dependencies.

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

`node build/testDesktopUpdates.js` runs genuine NSIS updaters 6.8.10 and 4.6.5
against a local HTTP fixture. It covers RC/stable selection, prerelease opt-out,
newer stable releases, RC-only repositories, missing releases, corrupt and
interrupted downloads, retry, cache reuse across updater instances and recovery
from a corrupted cached installer. The new updater also exercises full-download
fallback after a missing blockmap. Fixture payloads are inert text.

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
confirm that startup never supplies install consent. Other application features
still use `@electron/remote`; this is one step toward removing it.

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
