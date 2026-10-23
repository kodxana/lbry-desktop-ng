# Desktop regression checks

The [React and Material UI migration](react-and-material.md) adds autocomplete
and tooltip interaction, comic-page rendering and real Fast Refresh checks.
React 19 checks cover tooltip defaults, error-boundary reporting/recovery,
automatic batching, consistent Redux/router locations,
redirects, history menus, fast wallet encryption/unlock completion, leaving
pending password dialogs, and image-viewer zoom, rotation and keyboard focus.

The Desktop workflow runs on pull requests, pushes to master and the restoration
branches, and manual dispatches. Windows 2022 and Ubuntu 24.04 runners use the
Node 24.21.0 from `.node-version`, Yarn 3.2.0 and Electron 44.7.0. The
[build-tooling migration](build-tooling.md) moves compilation to Webpack 5.
The [packaging/updater migration](packaging-updater.md) adds old-client metadata
compatibility, cache recovery, interrupted downloads and install-handoff checks.
Further dependency upgrades are separate changes; installing the lockfile must
not change it. The pinned
Linux SDK requires glibc 2.36 or newer, so it cannot run on Ubuntu 22.04.

The [state-management upgrade](state-management.md) adds selector immutability,
nested React subscription, thunk and persistence-filter checks, plus real
compressed playback-state preservation across installed Windows upgrades.

The [shared UI upgrade](ui-components.md) adds QR pixel decoding, pagination,
dialog focus, update progress, floating-player dragging and thumbnail checks.

The [Reach replacement](accessible-controls.md) checks Ariakit keyboard/focus,
tab indicator geometry and retained drafts, menu routing/dismissal, search selection,
RTL and dark/light menu captures.

The [collection controls migration](collection-controls.md) adds real keyboard
and mouse reordering in all three list editors, cancellation and focus checks,
persisted order, and native radio selection in the dropped-file chooser.

The [browser integration migration](browser-integrations.md) checks CAPTCHA
callback and navigation races, legacy emoji compatibility, native SDK Proxy
calls, and sandboxed HMAC signing with all external integration requests blocked.

The [comic reader migration](comic-reader.md) checks decoded page pixels,
book/manga layouts, navigation, zoom, fullscreen, dark/light captures and cleanup.
It also verifies RAR 4/5 contents, encrypted/invalid archives, worker failures,
the pinned worker/WASM pair and decoding without renderer Node privileges.

The [forms and dates upgrade](forms-and-dates.md) adds send confirmation/retry,
publish date editing, timed blocks, locale and duration formatting checks.

## Checks

| Check                   | Coverage                                                                                                                                                                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test:desktop`          | Native disk capacity and unusual paths; unknown versus full storage; hub protocol, timeouts and rollback; startup and history progress, stale replies, concurrent balance polls; real GitHub/NSIS provider parsing and download checksums; update consent and clean SDK shutdown before installation. |
| `test:renderer`         | Production renderer loaders and aliases; actual Redux store, reducers, persistence transforms, React/Redux bindings and connected router; fresh defaults, old saved-state fixture, restart after writing; link/push/back navigation and unmount.                                                      |
| `test:sdk-isolation`    | Pinned SDK executable against a local regtest hub; settings-only startup without wallet creation; occupied TCP/UDP ports; corrupt binary cache; first sync, restart and recovery from a stalled hub; the same empty wallet and seven clean shutdowns.                                                 |
| `test:desktop-package`  | Built application entry points, version, SDK executable hash and provenance; GitHub update destination; installer/AppImage size and SHA-512 metadata; Linux SDK execute permission.                                                                                                                   |
| `test:packaged-desktop` | Launch the built unpacked application with a disposable NG profile; show the hub picker before creating a wallet; select the fixture hub, finish history sync and close both desktop and SDK cleanly.                                                                                                 |

The renderer suite opens separate Electron windows against one temporary
IndexedDB profile. The fresh, legacy fixture, and restart phases must retain
settings, subscriptions, collections, playback history/positions and the receive
address, but discard cached balance, wallet-sync status and daemon readiness.
The compressed fixture in `build/tests/fixtures/persist-v0.json` was encoded with
the RC2 dependency lock at commit `7568f7d6`. It contains only invented preferences
and a deliberately invalid public address, never wallet secrets. Keep the serialized
fixture unchanged during migrations; regenerating it with new dependencies would
remove the old-format compatibility check.

Additional renderer phases mount the production document viewers, file selector,
update prompt, wallet backup card and encryption/unlock forms with the real store
and router:

- Media checks mount the production Video.js player against generated MP4, HLS
  and audio fixtures. They verify decoding, HTTP ranges, redirect/type detection,
  MediaSource, pause, seek, playback completion and disposal. The
  [Video.js 8 checks](media-player.md) also cover custom controls, keyboard speed
  overlays, tracking events, manual/Auto HLS quality selection, source changes
  and unmounting during type detection. Only the fixture's
  loopback origin is allowed during that phase; no network media is downloaded.

- Bundling checks load the real application styles and verify dark/light themes,
  primary button colors, RTL layout, emitted image URLs, shader source imports,
  lazy chunks and platform metadata from the desktop bridge.

- Generated DOCX files cover headings, emphasis, tables, safe links, executable
  link removal and corrupt archives. A separate sanitizer fixture checks active
  elements, event attributes, local/remote images and embedded raster images.
- Updater tests use the production IPC, Redux listener and connected modal with
  controlled downloads and SDK shutdown. They cover install/decline choices,
  duplicate clicks, decline acknowledgement failures, download/shutdown retries,
  progress, late initial replies and cleanup. A new renderer must recover a
  declined background download without prompting or installing. Separate tests
  reach the real NSIS updater's install handoff, intercepting installer launch
  and app quit; no native installer is executed.
- Markdown covers asynchronous document bytes, formatting and unsafe markup/links. Plain text
  goes through CodeMirror, including literal markup, Unicode, read-only mode,
  theme changes and missing files. PDF/HTML checks cover local file URL encoding;
  HTML also retains its empty sandbox. The PDF fixture additionally paints a known
  rectangle through Chromium's built-in viewer; captured pixels verify rendering
  and `dist/ci/pdf-preview.png` provides visual evidence. Complex PDFs and printing
  still need manual acceptance.
- File selection uses scripted responses at `dialog.showOpenDialog`, the production
  `select-file` IPC handler (without `@electron/remote`),
  and Chromium file inputs populated through CDP. Tests cover filters, cancellation,
  Unicode paths, directory and metadata-only selection, repeated selection of the
  same file, disabled controls, read/dialog failures, retry, duplicate requests
  and unmounting while a dialog is open. Dialogs belong to the app window.
  Successful selections preserve separate file/folder locations for the session;
  cancellation, failed reads and rejected requests do not replace them.
  `node build/testFileSelection.js` also checks request validation, main-frame
  sender restrictions, cancellation without disk access, and discarding results
  when the window is closed, replaced or navigated away. The handler reads only
  paths returned by the picker; the old `get-file-from-path` endpoint is removed.
  Packaged and development smoke tests verify that the handler recognizes each
  renderer's document URL before validating a request. OS file-picker
  interaction itself is not automated.
- Native Chromium drops exercise single and multiple-file publishing, repeated
  drops, identical filenames in different folders, chooser cancel/accept and
  cancellation of delayed navigation on unmount. Browser inputs and thumbnail
  confirmation verify `webUtils` paths and reject files without disk backing.
  Upload calls are intercepted; no content is published or uploaded.
- Window controls use `window-control` IPC for header maximization, player Escape
  and Quit. The main process accepts only these explicit commands from the active
  application's main frame; native fullscreen exit is forwarded back to the
  renderer. Tests mount the real header/player and dispatch the real Quit actions,
  replacing only the native window methods and DOM fullscreen boundary. They cover
  duplicate fullscreen events, an already-exited document, rejected DOM exits,
  the legacy WebKit fallback and listener cleanup. `node build/testWindowControls.js`
  checks command and sender restrictions. Packaged smoke tests use the new Quit
  command and verify clean SDK shutdown; development smoke tests retain native
  window-close coverage. Window-manager behavior still needs desktop acceptance.
- Context menus use `context-menu` IPC with fixed text, editor, snippet and claim
  requests. The main process creates the menu and owns native editing commands;
  no renderer-provided menu templates or callbacks cross IPC. Tests cover request
  and sender restrictions, read-only fields, selection state, development-only
  inspection, dismissal, duplicate requests and stale menus after navigation or
  window destruction. The renderer suite builds real Electron menus and drives
  CodeMirror's context-menu event, full-document selection and claim actions.
  Chromium focus emulation lets the hidden editor fixture receive DOM focus events.
  Popup selection is controlled at the native boundary. Hosted Windows/Linux CI
  also checks real clipboard copy/cut/paste in text fields, document selection and
  CodeMirror. Local runs intercept clipboard operations to preserve the user's
  clipboard. Native menu mouse/keyboard interaction still needs manual acceptance.
  Electron 44 uses asynchronous main-process clipboard reads, with failures and
  cancellation during navigation/destruction covered. Claim links and URI buttons
  use the browser Clipboard API; tests cover delayed success, denial, retry and
  real OS writes on hosted CI.
- Backups use the real UI, main-process `wallet-backup` service and ZIP library with invented
  wallet bytes. Tests read the ZIP back and verify unchanged contents and portable
  filenames. Downloads/home/wallet-parent fallback, missing sources, failed writes,
  IPC failures, retries, duplicate clicks, unmount and switching wallets during
  a pending lookup are covered. All destinations are inside the fixture profile;
  opening the file manager is intercepted. Write failures never silently redirect
  a backup to another directory.
- Download notifications exercise the real completion action, Redux and IPC with
  controlled SDK responses. Tests cover notification preferences, missing titles,
  incomplete/zero-byte downloads, stopped polling after deletion, background counts,
  foreground completion, click-to-restore/focus, delayed snapshots and cleanup.
  The main process owns the unread count and resets it on focus on every platform.
  Native notification popups and window methods are intercepted; macOS dock calls
  are checked through a fixture, not a macOS runtime.
- Encryption, unlock, lock and decrypt actions use the real reducers with a
  controlled SDK transport to check success, false responses and rejected requests.
  The forms cover password confirmation, acknowledgement, retry, session caching,
  stale unlock results, and edits during an encryption request. Remember-password
  remains opt-in. Further phases exercise the real cookie shim and password IPC,
  safe migration, an unavailable secret store, acknowledgement of save failures,
  Forget retry, account-sync opt-in, and local cleanup when remote sign-out fails.

The SDK isolation suite also encrypts an empty generated wallet, rejects a wrong
password and decrypt-while-locked, restarts it, and restores an encrypted ZIP into
a second fresh profile. It verifies zero balance and identical addresses, seed and
private key after unlock/decrypt and another restart. Keys are compared only in
memory and are never included in assertion output. The suite now checks eleven
clean SDK shutdowns across the original and restored profiles. Wallets and backup
archives stay in ignored test directories and are not uploaded as CI evidence.

The application and renderer harness no longer use `@electron/remote`. The small
cookie adapter is maintained locally with its original MIT license, cookie jar,
storage format and file-URL mapping. A guarded synchronous IPC supplies only the
application path needed when installing the synchronous `document.cookie` shim.
Cookie/password migration, account-token persistence across renderer restarts and
sign-out are covered. Package verification rejects both removed remote dependencies
and checks that the adapter license is included.

The renderer harness still uses the application's Node integration settings.
It will need to move with the real application when preload isolation is
introduced. All HTTP(S)/WebSocket requests are blocked in its Electron session.
The old analytics module attempts to load `analytics.lbry.com/matomo.js`; this is
blocked explicitly, while attempts to contact an SDK or another service fail the test.
The suite uses real state and routing code, not mock reducers or in-memory storage.

## Remembered passwords

New remembered passwords use Electron `safeStorage` in the main process. The
profile's `remembered-password.json` contains ciphertext; session-only passwords
stay in renderer memory. Windows uses the current user's DPAPI-backed Chromium
key, macOS uses Keychain, and Linux requires a supported unlocked secret store.
The Linux hardcoded-key fallback is refused. This protects storage at rest; it
is not protection against code already running as the user or in the renderer.
Keep your wallet password separately: a copied desktop profile is not a portable
password backup, and changing or losing OS keys can make a remembered copy unreadable.
The wallet itself is not modified by password storage or migration.

Legacy `saved_password` cookies are read from both the Electron cookie shim's
`__cookieStore__` and Chromium's cookie store for LBRY origins. Migration writes
and reads back an encrypted record without changing the stored password text.
The old copy is retained until **the next main-process launch** can decrypt the
record. Only then is the migration committed and the old password cookie removed;
other cookies, including the account token, are left alone. Electron 17 can delay
persisting a new Windows encryption key, so an immediate first-launch crash must
leave a recovery copy. If copies disagree, the app asks for manual entry instead
of choosing and deleting one. Unreadable committed records are left intact.

Forgetting, signing out, or successfully submitting a password with Remember
unchecked first writes a durable opt-out marker and then removes legacy copies.
This prevents an interrupted cleanup from restoring an old password on restart.
Forgetting and signing out also clear the session cache. Failed operations show
a native warning; a failed Forget stays retryable. A successful wallet operation
is not repeated merely because its password could not be remembered. Cookie
removal is logical deletion, not secure erasure of old browser database pages.

`node build/testPasswordStorage.js` tests atomic writes, disk and verification
failures, Unicode/special characters, legacy formats, conflicts, cleanup failures,
opt-out across restart, serialized requests and rejected IPC senders. The renderer
suite injects the OS-encryption boundary so storage failures are deterministic;
it retains the actual forms, cookie shim and IPC implementation.

`node build/testPasswordStorage.js --native` separately uses real Electron and
fresh processes to test OS encryption, an interrupted migration, recovery,
restart, and forgetting. Windows runs against DPAPI. Linux CI runs
`dbus-run-session -- xvfb-run -a sh build/tests/passwordKeyring.sh` with an isolated
GNOME keyring and also checks refusal of `--password-store=basic`. All passwords,
keyrings and profiles are disposable fixtures under `dist/password-tests`; none
are uploaded as artifacts. macOS Keychain is not covered by this matrix.

## Run locally

From a checkout with Node 24.21.0 on PATH:

```text
node .yarn/releases/yarn-3.2.0.cjs install --immutable --mode=skip-build
node .yarn/releases/yarn-3.2.0.cjs exec install-electron
node build/runDesktopTests.js
node build/testRenderer.js
```

On a headless Linux host, use `xvfb-run -a node build/testRenderer.js`. The workflow
lists the runtime libraries needed on Ubuntu. Ubuntu 24.04's hosted runner also
requires Electron's `chrome-sandbox` helper to be root-owned with mode 4755;
CI configures the installed and unpacked test copies on that disposable runner.
It does not use `--no-sandbox`. Renderer logs are in `dist/ci`.

After importing the SDK candidate, `node build/testPackagedDesktop.js --development`
tests the real development server and Electron launch with a disposable profile,
local hub and clean shutdown. Use `xvfb-run -a` on headless Linux. Developer
extension downloads are skipped. This runs after packaged verification in CI,
so its development output cannot be included in the already-built packages.

For SDK integration and packaging, import an already verified candidate using
`node build/downloadDaemon.js /absolute/path/to/lbrynet`, or run
`node build/fetchSdkCandidate.js` with a GitHub token that can read public Actions
artifacts in `GITHUB_TOKEN`. The helper verifies the successful source run, artifact
identity, ZIP SHA-256 and executable SHA-256 against `build/sdk-candidate.json`.
It never downloads the older public SDK release as a fallback. Actions artifacts
expire: an expired pin must be supplied from a matching archive or deliberately
replaced with another tested candidate. No personal access token is stored in CI;
the workflow uses its read-only GitHub token.

```text
node build/buildDesktop.js
node build/testDesktopPackage.js
node build/testPackagedDesktop.js
```

Use Xvfb for the final command on headless Linux. The SDK isolation suite reserves
ports 35279/35280/34444; the packaged NG smoke test reserves 36279/36280/35444.
An occupied port causes failure before any RPC request. Do not run these tests
alongside another test using those ports, including through WSL localhost forwarding.
The packaged smoke test must wait until any running NG app is closed normally.
It creates its own profile and does not reuse the user's application data.

## Artifacts and upgrade gates

CI keeps Windows installers, Linux AppImage/tar packages and verification records
for 14 days. Builds are unsigned and use `--publish never`; CI creates no release
and installs no update. Failure diagnostics include console logs from the
disposable SDK and packaged-app fixtures. Wallet files, browser profiles and SDK
databases are excluded from uploads. No signing or publishing secrets are available
to the jobs.

For each dependency migration, keep the existing fixture checks, add regressions
for changed APIs, and require both platform jobs to pass. The application source,
lockfile and SDK pin should change only as described by that migration PR.

This is an automated baseline, not complete desktop acceptance. Full media playback
(HLS, subtitles, seeking, hardware decoding), complex PDFs and printing, native
file-picker interaction, installed old-to-new upgrades,
account services and funded transactions still need separate acceptance checks.
The packaged smoke uses an empty regtest wallet and the unpacked output;
it does not establish installer behavior, real hub performance or mainnet balance
correctness. No macOS desktop coverage is provided yet.

The production renderer is sandboxed. The component fixture runner and the separate
fully sandboxed preload suite have different responsibilities; see
[renderer isolation](renderer-isolation.md) for the boundary and validation details.
