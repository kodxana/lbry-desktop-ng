# LBRY SDK Test for Windows

This is a local compatibility build based on the original LBRY Desktop 0.53.9,
maintained by the community for SDK testing. It is not an LBRY Inc. release.
It uses a verified Windows SDK candidate containing the shutdown fixes from
SDK NG PR #27, the wallet hubs from PR #29, header sync improvements from PR #30,
and the pending PR #28 for interrupted startup. The SDK still reports
`0.114.0rc4`; the public rc4 release
predates these fixes.
`SDK-CANDIDATE.json` records the exact source and hashes. The current pin is
Windows-only; Linux/macOS builds need corresponding verified candidates.

Extract the entire ZIP, then run `LBRY SDK Test.exe`. Closing its window quits
the desktop and waits for its SDK to exit. No installer is required.

## Isolation

- The default profile is `%APPDATA%\LBRY SDK Test`. It contains separate desktop,
  SDK data, wallet, downloads and log directories. No existing wallet is imported.
- For a different location, launch with `--sdk-test-root="F:\some-empty-folder"`.
  The directory must be empty or already belong to this test app.
- SDK RPC uses `127.0.0.1:35279`; media uses `127.0.0.1:35280`. Peer traffic uses
  TCP/UDP 34444. Startup refuses occupied ports and never attaches to another SDK.
- Automatic updates, Windows autostart and `lbry://` registration are disabled.
  UPnP and SDK usage reporting are disabled. The app still uses the public LBRY
  network and its existing external services; this is not an offline mode.
- The bundled SDK hash is checked before every launch. Only the SDK child owned
  by this app is stopped on exit. Logs are under the test profile's `logs` folder.

Use a fresh, unfunded wallet for these compatibility checks. Full mainnet-node
operation is not needed; the SDK uses a light wallet and public wallet servers.

## Rebuild

Use Node 16.20.2 and the checked-in Yarn 3.2.0. The original desktop runtime is
Electron 17.2.0; modernizing that runtime is separate restoration work.

1. Install the original lock without postinstall scripts:
   `node .yarn/releases/yarn-3.2.0.cjs install --immutable --mode=skip-build`.
2. Download [lbrynet-windows.zip](https://github.com/kodxana/lbry-desktop-ng/releases/download/v0.54.0-rc.1/lbrynet-windows.zip)
   from the Desktop NG prerelease and extract `lbrynet.exe`. This preserves the
   exact SDK from [CI run 38164960994](https://github.com/kodxana/lbry-sdk-ng/actions/runs/38164960994).
   The ZIP's SHA-256 is `a9432175a1c4d86d1b3a0557a8eb65e4927d57265d76a6e6579787af971694e1`.
3. Run `node build/downloadDaemon.js "path\to\lbrynet.exe"`.
   This verifies SHA-256 before replacing the cached executable. A failed import
   preserves the existing cached file.
4. Run `node node_modules/electron/install.js`, then `node build/buildSdkTest.js`.
   It runs update and isolation/restart tests, compiles both bundles and creates a ZIP under
   `dist/sdk-test`. It does not publish or sign the build.

The SDK acquisition step accepts `LBRY_SDK_BINARY` as an alternative to a file
argument. A runtime `LBRY_DAEMON` override must match the same pinned hash;
`LBRY_HEADERS` is a separate optional initial-header file.

The separately named NG installer enables GitHub updates and uses different
ports and profiles. See [Desktop NG builds and updates](desktop-ng-releases.md).

## Compatibility checks

Check startup and header sync, the empty wallet, free-content search/resolve and
playback, download interruption/resume, and clean shutdown/restart. Wallet
encryption/backup and persistence need separate UI checks before declaring full
desktop compatibility. This Windows build does not establish Linux, macOS,
paid-content, funded-transaction or account/cloud-service compatibility.
