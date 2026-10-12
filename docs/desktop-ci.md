# Desktop regression checks

The Desktop workflow runs on pull requests, pushes to master and the restoration
branches, and manual dispatches. Windows 2022 and Ubuntu 24.04 runners use the
current Node 16.20.2, Yarn 3.2.0 and Electron 17.2.0 baseline. Dependency upgrades
are separate changes; installing the lockfile must not change it. The pinned
Linux SDK requires glibc 2.36 or newer, so it cannot run on Ubuntu 22.04.

## Checks

| Check                   | Coverage                                                                                                                                                                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test:desktop`          | Native disk capacity and unusual paths; unknown versus full storage; hub protocol, timeouts and rollback; startup and history progress, stale replies, concurrent balance polls; real GitHub/NSIS provider parsing and download checksums; update consent and clean SDK shutdown before installation. |
| `test:renderer`         | Production renderer loaders and aliases; actual Redux store, reducers, persistence transforms, React/Redux bindings and connected router; fresh defaults, old saved-state fixture, restart after writing; link/push/back navigation and unmount.                                                      |
| `test:sdk-isolation`    | Pinned SDK executable against a local regtest hub; settings-only startup without wallet creation; occupied TCP/UDP ports; corrupt binary cache; first sync, restart and recovery from a stalled hub; the same empty wallet and seven clean shutdowns.                                                 |
| `test:desktop-package`  | Built application entry points, version, SDK executable hash and provenance; GitHub update destination; installer/AppImage size and SHA-512 metadata; Linux SDK execute permission.                                                                                                                   |
| `test:packaged-desktop` | Launch the built unpacked application with a disposable NG profile; show the hub picker before creating a wallet; select the fixture hub, finish history sync and close both desktop and SDK cleanly.                                                                                                 |

The renderer suite opens three separate Electron windows against one temporary
IndexedDB profile: fresh, legacy fixture, and restart. The last phase must retain
settings, subscriptions, collections, playback history/positions and the receive
address, but discard cached balance, wallet-sync status and daemon readiness.
The compressed fixture in `build/tests/fixtures/persist-v0.json` was encoded with
the RC2 dependency lock at commit `7568f7d6`. It contains only invented preferences
and a deliberately invalid public address, never wallet secrets. Keep the serialized
fixture unchanged during migrations; regenerating it with new dependencies would
remove the old-format compatibility check.

The renderer harness uses the current desktop Node integration settings and remote
module. It will need to move with the real application when preload isolation is
introduced. All HTTP(S)/WebSocket requests are blocked in its Electron session.
The old analytics module attempts to load `analytics.lbry.com/matomo.js`; this is
blocked explicitly, while attempts to contact an SDK or another service fail the test.
The suite uses real state and routing code, not mock reducers or in-memory storage.

## Run locally

From a checkout with Node 16.20.2 on PATH:

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

This is an initial automated baseline, not complete desktop acceptance. Full media
playback (HLS, subtitles, seeking, hardware decoding), document rendering/sanitizing,
native file dialogs, wallet backup/encryption, installed old-to-new upgrades,
account services and funded transactions still need separate fixtures or acceptance
checks. The packaged smoke uses an empty regtest wallet and the unpacked output;
it does not establish installer behavior, real hub performance or mainnet balance
correctness. No macOS desktop coverage is provided yet.
