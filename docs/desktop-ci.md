# Desktop regression checks

The Desktop workflow runs on pull requests, pushes to master and the restoration
branches, and manual dispatches. Windows 2022 and Ubuntu 24.04 runners use the
Node 24.21.0 from `.node-version`, Yarn 3.2.0 and Electron 17.2.0. The
[build-tooling migration](build-tooling.md) moves compilation to Webpack 5.
The [packaging/updater migration](packaging-updater.md) adds old-client metadata
compatibility, cache recovery, interrupted downloads and install-handoff checks.
Further dependency upgrades are separate changes; installing the lockfile must
not change it. The pinned
Linux SDK requires glibc 2.36 or newer, so it cannot run on Ubuntu 22.04.

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
wallet backup card and encryption/unlock forms with the real store and router:

- Bundling checks load the real application styles and verify dark/light themes,
  primary button colors, RTL layout, emitted image URLs, shader source imports,
  lazy chunks and Electron's runtime environment access.

- Generated DOCX files cover headings, emphasis, tables, safe links, executable
  link removal and corrupt archives. A separate sanitizer fixture checks active
  elements, event attributes, local/remote images and embedded raster images.
- Markdown covers streamed chunks, formatting and unsafe markup/links. Plain text
  goes through CodeMirror, including literal markup, Unicode, read-only mode,
  theme changes and missing files. PDF/HTML checks cover local file URL encoding;
  HTML also retains its empty sandbox. These are not PDF pixel-rendering tests.
- File selection uses scripted responses at `dialog.showOpenDialog`, the production
  `select-file` IPC handler (without `@electron/remote`),
  and Chromium file inputs populated through CDP. Tests cover filters, cancellation,
  Unicode paths, directory and metadata-only selection, repeated selection of the
  same file, disabled controls, read/dialog failures, retry, duplicate requests
  and unmounting while a dialog is open. Dialogs belong to the app window.
  `node build/testFileSelection.js` also checks request validation, main-frame
  sender restrictions, cancellation without disk access, and discarding results
  when the window is closed, replaced or navigated away. The handler reads only
  paths returned by the picker; the old `get-file-from-path` endpoint is removed.
  Packaged and development smoke tests verify that the handler recognizes each
  renderer's document URL before validating a request. OS file-picker
  interaction itself is not automated.
- Backups use the real UI and ZIP library with invented wallet bytes. Tests read
  the ZIP back, verify its contents and portable filename, and check missing-source
  and unwritable-destination errors. Downloads is redirected inside the fixture
  profile and opening the file manager is intercepted.
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

The renderer harness uses the current desktop Node integration settings and remote
module. It will need to move with the real application when preload isolation is
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
node node_modules/electron/install.js
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
(HLS, subtitles, seeking, hardware decoding), PDF page rendering/printing, native
file-picker interaction, installed old-to-new upgrades,
account services and funded transactions still need separate acceptance checks.
The packaged smoke uses an empty regtest wallet and the unpacked output;
it does not establish installer behavior, real hub performance or mainnet balance
correctness. No macOS desktop coverage is provided yet.
