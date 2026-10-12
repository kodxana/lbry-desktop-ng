# Electron runtime migration

The source build moves from Electron 17.2.0 to 22.3.27. This is an intermediate
checkpoint, not a supported-runtime release. Electron 22 is end-of-life. Continue
the migration to a supported version before treating runtime modernization as
complete. The published 0.54.0-rc.3 installers remain on Electron 17.2.0.

This step keeps the embedded Node major at 16 while crossing the Chromium and
Electron API changes in versions 18–22. It separates those changes from the next
embedded Node major upgrade. The SDK binary, wallet format, React, updater and
application version are unchanged.

## Breaking changes reviewed

References: [Electron 22.3.27 runtime versions](https://releases.electronjs.org/release/v22.3.27)
and [the pinned release's migration notes](https://github.com/electron/electron/blob/v22.3.27/docs/breaking-changes.md).

- Electron 18 removes `nativeWindowOpen`; the application does not set it.
- Electron 20 sandboxes renderers by default unless Node integration is enabled.
  The application still explicitly uses `nodeIntegration: true` and
  `contextIsolation: false`. Moving filesystem work behind a preload boundary
  remains separate work; this step does not claim renderer isolation.
- Electron 21 enables the V8 memory cage. The application package has no native
  Node addons; the SDK and its native libraries run in their separate process.
- Electron 22 removes `new-window`. External links already use
  `setWindowOpenHandler`; the application does not embed an Electron `webview`.
- Removed Linux taskbar options and changed PDF printing/device permission APIs
  are not used. CI covers Windows x64 and Ubuntu x64 only; macOS and old OS
  versions are not validated by this change.

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
- Native password tests exercise OS storage across process restarts, including
  Windows DPAPI and an isolated Linux GNOME keyring. Real SDK tests restore an
  encrypted backup and compare the generated unfunded wallet's keys/addresses.
- Packaged and development smoke tests assert the running Electron version,
  complete local hub sync and verify clean SDK shutdown. Package inspection
  rejects unexpected native addons and verifies the SDK and update digests.
- The hosted Windows installed-upgrade test moves the checksum-pinned RC3
  (Electron 17) to the private Electron 22 candidate, then to a second candidate.
  It asserts both main and renderer runtime versions, install/decline choices,
  SDK exit before NSIS, automatic restart, unchanged wallet keys/addresses,
  encryption, remembered passwords and cookie/localStorage persistence. An
  IndexedDB database created by the actual Electron 17 renderer must also
  survive both upgrades with unchanged fixture contents.

All wallet tests use disposable, unfunded fixtures. Installed upgrades run only
on fresh GitHub-hosted Windows runners and publish no releases. Linux updates
remain manual. Full media playback (including HLS/hardware decoding), PDF page
rendering/printing, native dialog presentation and notification popups still need
manual acceptance on the upgraded runtime.
