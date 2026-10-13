# Electron runtime migration

The source build moves from Electron 22.3.27 to 28.3.3. This is an intermediate
checkpoint, not a supported-runtime release. Electron 28 is end-of-life. Continue
the migration to a supported version before treating runtime modernization as
complete. The published 0.54.0-rc.3 installers remain on Electron 17.2.0.

This step moves the embedded Node runtime from 16 to 18.18.2 and Chromium to
120.0.6099.291. It adds offline playback tests before crossing further media
and runtime changes. The SDK binary, wallet format, React, updater and application
version are unchanged.

## Breaking changes reviewed

References: [Electron 28.3.3 runtime versions](https://releases.electronjs.org/release/v28.3.3)
and [the pinned release's migration notes](https://github.com/electron/electron/blob/v28.3.3/docs/breaking-changes.md).

- Electron 23 drops Windows 7, 8 and 8.1. Windows 10 or later is required.
  The NSIS initialization guard rejects older Windows before replacing files,
  including silent installation. RC1–RC3's updater ignores minimum-OS metadata,
  and the pinned builder does not expose that field for Windows. An old client
  can still offer and download the update, but the installer leaves its existing
  files intact. Portable ZIP builds have no installer guard.
- Electron 27 drops macOS 10.13 and 10.14. A future macOS build needs 10.15 or
  later, but this project currently validates Windows and Linux only.
- Removed scroll-touch events, WebContents capturer-count APIs, `getPrinters`,
  appearance notifications, traffic-light positioning and `sendTo`/sender IDs
  are not used. Deprecated protocol registration/interception and changed
  thumbnail scaling and input-form metadata do not affect current call sites.
- `backgroundThrottling` behavior changes in Electron 28; production windows do
  not disable it. Playback checks explicitly exercise play, pause and seek.

The previous 17-to-22 step removed obsolete crash handling and dialog callbacks.
External links already use `setWindowOpenHandler`; there are no Electron webviews
or native Node addons. The SDK's native libraries run in a separate process.
The application still explicitly uses `nodeIntegration: true` and
`contextIsolation: false`. Moving filesystem work behind a preload boundary
remains separate work; this step does not claim renderer isolation.

Window failure handling also now consumes the Promise returned by
`showMessageBox`, replacing an obsolete callback that ignored Quit. Wait and
dialog dismissal keep the application running. Repeated or stale prompts cannot
start another shutdown. `render-process-gone` replaces `crashed`; an unexpected
renderer exit reports the failure and calls `app.quit()` through the existing
SDK shutdown lifecycle, retaining the window reference until shutdown. Ordinary
shutdown and clean renderer exits do not show a crash notice.

## Validation

- Desktop unit tests exercise Wait/Quit/dismissal, failed dialogs, repeated
  events, renderer failures and shutdown races. The Electron renderer suite
  also deliberately crashes a disposable real renderer and checks the normal
  quit request without destroying its window early.
- The existing renderer tests run backup ZIP round-trips, destination fallbacks,
  errors/cancellation, wallet encryption controls, document rendering, file
  selection, saved state, passwords, notifications and updater consent.
- Production Video.js tests use small generated H.264/AAC fixtures served only
  on loopback. They cover MP4 ranges, the real HEAD/redirect path into HLS and
  MediaSource, audio, decoded frames, pause, seek, end-of-playback and disposal.
  External requests remain blocked. See the fixture README for regeneration.
- Native password tests exercise OS storage across process restarts, including
  Windows DPAPI and an isolated Linux GNOME keyring. Real SDK tests restore an
  encrypted backup and compare the generated unfunded wallet's keys/addresses.
- Packaged and development smoke tests assert the running Electron version,
  complete local hub sync and verify clean SDK shutdown. Package inspection
  rejects unexpected native addons and verifies the SDK and update digests.
- A compiled NSIS fixture runs the production guard with supported,
  unsupported and native OS detection; its only install action writes a marker
  in `dist`. The unsupported case exits with 1633 without reaching that action.
  This checks the guard, not actual installation on a Windows 7 virtual machine.
- The hosted Windows installed-upgrade test moves the checksum-pinned RC3
  (Electron 17) to the private Electron 28 candidate, then to a second candidate.
  It asserts both main and renderer runtime versions, install/decline choices,
  SDK exit before NSIS, automatic restart, unchanged wallet keys/addresses,
  encryption, remembered passwords and cookie/localStorage persistence. An
  IndexedDB database created by the actual Electron 17 renderer must also
  survive both upgrades with unchanged fixture contents.

All wallet tests use disposable, unfunded fixtures. Installed upgrades run only
on fresh GitHub-hosted Windows runners and publish no releases. Linux updates
remain manual. Hardware video decoding, audible output, subtitles and the full
player controls, PDF page rendering/printing, native dialog presentation and
notification popups still need manual acceptance on the upgraded runtime.
