# Electron runtime migration

The source build moves from Electron 28.3.3 to 34.5.8. This is an intermediate
checkpoint, not a supported-runtime release. Electron 34 is end-of-life. Continue
the migration to a supported version before treating runtime modernization as
complete. The published 0.54.0-rc.3 installers remain on Electron 17.2.0.

This step moves the embedded Node runtime from 18 to 20.19.1 and Chromium to
132.0.6834.210. It replaces the removed native `File.path` API with
`webUtils.getPathForFile` for file inputs and publishing drops. The SDK binary,
wallet format, React, updater and application
version are unchanged.

## Breaking changes reviewed

References: [Electron 34.5.8 runtime versions](https://releases.electronjs.org/release/v34.5.8)
and [the pinned release's migration notes](https://github.com/electron/electron/blob/v34.5.8/docs/breaking-changes.md).

- Electron 32 removes native `File.path`. Browser-picked files, drag-and-drop
  publishing and thumbnail selection resolve the native path with `webUtils`.
  Files created only in JavaScript have no local path and are rejected instead
  of treating their filename as one. Native file-dialog IPC still supplies its
  explicit `FileWithPath` wrapper; thumbnail confirmation consumes that wrapper.
  The web build retains its existing filename/File behavior.
- Electron 31 removes WebSQL and Electron 32 removes Chromium's `databases`
  directory. The app uses localForage/IndexedDB; no explicit WebSQL driver or
  `openDatabase` call is configured. The hosted upgrade test carries real
  IndexedDB data from RC3 through both installs. SDK data and wallet directories
  are siblings of the desktop browser profile, outside `databases`; wallet
  backup/restore and installed-upgrade tests still verify their preservation.
- Electron 29 removes legacy crash events; production already uses
  `render-process-gone`. Changes to contextBridge IPC exposure, BrowserView,
  WebContents navigation and custom file-protocol registration have no affected
  call sites. Existing IPC guards reject missing/stale sender frames, including
  after asynchronous work. Native clipboard tests cover editing commands on
  both hosted operating systems.
- Electron 33 requires macOS 11 and C++20 for native addons. There are no bundled
  Node addons; the SDK is a separate executable. macOS remains unvalidated.
- Electron 34 hides the Windows menu bar in fullscreen. Native fullscreen
  presentation remains a manual acceptance item; IPC and player exit behavior
  remain covered by the existing regression tests.

Earlier checkpoints also reviewed these changes:

- Electron 23 drops Windows 7, 8 and 8.1. Windows 10 or later is required.
  The NSIS initialization guard rejects older Windows before replacing files,
  including silent installation. RC1–RC3's updater ignores minimum-OS metadata,
  and the pinned builder does not expose that field for Windows. An old client
  can still offer and download the update, but the installer leaves its existing
  files intact. Portable ZIP builds have no installer guard.
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
- Chromium supplies real disk-backed files through CDP file inputs and native
  drop events. Tests cover repeated drops without replay, choosing between
  identical filenames in different directories, cancel/accept, missing native
  paths, delayed navigation on unmount, and thumbnail upload confirmation.
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
  (Electron 17) to the private Electron 34 candidate, then to a second candidate.
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
