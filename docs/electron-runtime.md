# Electron runtime migration

The source build moves from Electron 34.5.8 to 44.7.0, a supported stable release
as of October 13, 2026. Embedded Node moves from 20 to 24.21.0 and Chromium to
152.0.7977.130. The published 0.54.0-rc.3 installers remain on Electron 17.2.0.
Renderer isolation and other application dependencies still need modernization.
The SDK binary, wallet format, React, updater and application version are unchanged.

## Breaking changes reviewed

References: [Electron 44.7.0 runtime versions](https://releases.electronjs.org/release/v44.7.0)
and [the pinned release's migration notes](https://github.com/electron/electron/blob/v44.7.0/docs/breaking-changes.md).

- Electron 44 removes renderer access to `clipboard` and makes main-process
  clipboard reads/writes asynchronous. Claim links and URI buttons now use
  `navigator.clipboard.writeText`; a URI button reports success only after the
  write resolves and reports a denied write. Context-menu creation awaits the OS
  clipboard and cancels pending reads on navigation or destruction. Existing
  text, Markdown and document editing still use native WebContents commands.
- Electron 42 removes automatic binary downloads during package installation.
  CI and build instructions explicitly run the pinned `install-electron` command
  after installing the immutable lock without dependency lifecycle scripts.
  Electron's npm package now needs Node >=22.12; the build host is pinned to 24.
- Electron 43 defaults dialogs to Downloads instead of restoring the OS's last
  directory. The picker remembers successful file/folder directories separately
  for the current app session. Cancellation, failed reads and rejected senders
  do not replace them. Windows retains Home for the first selection. Linux
  portals older than version 4 may ignore `defaultPath` (Electron 35 change).
- Electron 41 renders PDFs in out-of-process frames within the same WebContents.
  The app does not track PDF guest WebContents. A generated page with a known
  colored rectangle is now rendered through the production viewer and checked
  through captured pixels, in addition to URL encoding and HTML sandbox checks.
  Cookie change-event cause names also changed; the app does not consume them.
- Electron 36 defaults to GTK 4 on GNOME; Electron 38 defaults to native Wayland
  in Wayland sessions. CI installs GTK 3 and 4 and uses Xvfb/X11. Native Wayland
  remains manual acceptance; `--ozone-platform=x11` can select XWayland when
  necessary. No global fallback flag is forced on users.
- Electron 43 changes Linux frameless window decorations; the app uses a normal
  framed window. Electron 44's ANGLE libraries are statically linked; this build
  neither replaces nor separately packages those libraries. Builds already target
  x64, so removal of 32-bit release artifacts does not change the supported targets.
- Changes to worker/subframe Node integration, DevTools extension preloads,
  utility processes, custom protocol sessions, client-certificate events,
  WebUSB/Serial, offscreen rendering, bitmap color spaces, storage quotas and
  WebRequest filters with empty URL lists have no affected production call sites.
  Popup creation is already denied or sent to the external browser.
- Electron 44 requires macOS 13; Electron 42 notifications also require a signed
  macOS application. macOS remains outside this project's validation matrix.

Earlier checkpoints covered the following changes:

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
- PDF tests capture the generated page from a hidden window and save
  `dist/ci/pdf-preview.png`. Clipboard tests cover asynchronous read failures,
  canceled reads, successful/denied URI copies and retry. Hosted CI exercises
  the real browser Clipboard API and native clipboard, while local runs preserve
  the user's clipboard. File-dialog tests cover remembered locations.
- Native password tests exercise OS storage across process restarts, including
  Windows DPAPI and an isolated Linux GNOME keyring. Real SDK tests restore an
  encrypted backup and compare the generated unfunded wallet's keys/addresses.
- Packaged and development smoke tests assert the running Electron version,
  complete local hub sync and verify clean SDK shutdown. Package inspection
  rejects unexpected native addons and verifies the SDK and update digests.
  Development translation collection finishes each write before another message
  or renderer reload can replace it. A rapid-message/reload regression checks
  valid JSON, retained messages and unchanged source translations.
- A compiled NSIS fixture runs the production guard with supported,
  unsupported and native OS detection; its only install action writes a marker
  in `dist`. The unsupported case exits with 1633 without reaching that action.
  This checks the guard, not actual installation on a Windows 7 virtual machine.
- The hosted Windows installed-upgrade test moves the checksum-pinned RC3
  (Electron 17) to the private Electron 44 candidate, then to a second candidate.
  It asserts both main and renderer runtime versions, install/decline choices,
  SDK exit before NSIS, automatic restart, unchanged wallet keys/addresses,
  encryption, remembered passwords and cookie/localStorage persistence. An
  IndexedDB database created by the actual Electron 17 renderer must also
  survive both upgrades with unchanged fixture contents.

All wallet tests use disposable, unfunded fixtures. Installed upgrades run only
on fresh GitHub-hosted Windows runners and publish no releases. Linux updates
remain manual. Hardware video decoding, audible output, subtitles and the full
player controls, complex PDFs and printing, native dialog presentation, Wayland
and notification popups still need manual acceptance on the upgraded runtime.
