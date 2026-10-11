# Desktop NG builds and updates

The first NG installer target is Windows x64. It bundles the SDK pinned in
[`build/sdk-candidate.json`](../build/sdk-candidate.json), including SDK NG
PR #27, the updated wallet hubs from PR #29, and the pending PR #28 startup
cancellation fix. The executable still reports SDK `0.114.0rc4`, but the older public rc4
release is a different binary. Build and startup both verify the pinned SHA-256.

## Build locally

Use Node 16.20.2 and the checked-in Yarn 3.2.0. Follow the dependency and SDK
acquisition steps in [the test build guide](isolated-desktop-test.md), then run:

```powershell
node build/buildDesktop.js
```

This runs the update tests and real SDK wallet/restart tests, compiles the app,
and builds an NSIS installer under `dist/ng`. It does not publish or install it.
The initial version is `0.54.0-rc.1`. Expected release files are:

- `LBRY-Desktop-NG-0.54.0-rc.1-windows-x64.exe`
- `LBRY-Desktop-NG-0.54.0-rc.1-windows-x64.exe.blockmap`
- `latest.yml`

These local builds are unsigned. A community signing identity has not been
configured. Electron 17.2.0 remains the compatibility baseline; runtime
modernization and installed upgrade acceptance are still outstanding.

`node build/buildSdkTest.js` continues to produce the separate test ZIP under
`dist/sdk-test`, with updates disabled. Do not publish a test ZIP as an installer
update. Use the build scripts rather than running electron-builder against
previously compiled bundles, which may belong to the other build flavor.

## Profiles and SDK ownership

The NG application is named **LBRY Desktop NG**, with application ID
`net.lbry.community.desktop`. Its default root is `%APPDATA%\LBRY Desktop NG`.
Desktop state, SDK data, wallet, downloads and logs live below that root. No
existing wallet is imported, and the original desktop's protocol/autostart
registration is not replaced. The installer uses its own application directory
and uninstall identity. Uninstalling does not delete the wallet/profile.

For an unpacked smoke test, run `dist/ng/win-unpacked/LBRY Desktop NG.exe` with
`--ng-profile="F:\an-empty-test-folder"`. The root must be empty or marked as
belonging to NG. The test ZIP's root is rejected as a different application.

NG uses loopback RPC port 36279, media port 36280 and peer TCP/UDP port 35444.
The test ZIP retains ports 35279, 35280 and 34444. Both builds refuse occupied
ports, start their own SDK, disable SDK usage reporting and UPnP, and wait for
their child SDK on exit. They still use public wallet servers and other existing
desktop services; this update migration does not replace all LBRY Inc. services.

## GitHub updates

Update discovery, installer downloads and release notes use
[`kodxana/lbry-desktop-ng` releases](https://github.com/kodxana/lbry-desktop-ng/releases).
[`release-source.json`](../release-source.json) declares the provider. The build
configuration has the same explicit owner/repository, checked by the tests.
electron-builder generates `resources/app-update.yml`; no inherited LBRY Inc.
configuration is copied over it. NG also has its own updater cache name.

Windows uses electron-updater's GitHub/NSIS path, including SHA-512 validation
of downloaded installers against release metadata. The application never
executes an installer path or download URL supplied by the renderer. After the
user accepts an update, it waits for the owned SDK to stop before starting NSIS.
A nonzero exit or forced termination blocks installation.
Closing the app normally does not install a pending update. Choosing “Not Now”
or “Keep browsing” cancels pending installation consent.

New prerelease profiles enable test releases by default. The existing settings
let users disable prereleases or automatic downloading. Stable checks use
GitHub's latest non-prerelease; test-release checks use its release feed.
Downgrades are disabled. Missing releases and network/download errors leave the
desktop running. Help shows the result of the most recent update check.
Linux and macOS currently use the GitHub releases page for manual downloads;
their packaging and automatic updates are not validated in this fork.

## Preparing a release

1. Bump `package.json` to a higher SemVer version, rebuild, and verify the SDK pin
   and update tests. Use a tag matching the version, such as `v0.54.0-rc.1`.
2. Upload the installer, its blockmap and `latest.yml` together to a release in
   this fork. Keep candidate releases marked **Prerelease**. The pinned updater
   reads `latest.yml` inside the selected release even for prereleases.
3. Check an installed version upgrading to a later version on a disposable
   Windows profile before promoting it. Verify wallet persistence, clean SDK
   shutdown, application restart, and the new bundled SDK hash.

The SDK candidate currently comes from a GitHub Actions artifact, which can
expire. Before public distribution, promote that verified SDK build to a durable
SDK NG release and update the acquisition instructions/provenance together.
Do not substitute the older rc4 release just because its version string matches.

No Desktop NG release has been published by these changes. A desktop CI release
workflow and signing setup remain separate work.

## Automated coverage

`node build/testDesktopUpdates.js` exercises the pinned electron-updater 4.6.5
GitHub provider and NSIS download path against local HTTP fixtures. It verifies
stable/prerelease selection, fork-only requests, opt-out of automatic download,
SHA-512 rejection and recovery, and missing-release handling. Installer execution
is replaced with assertions. Lifecycle tests cover explicit consent, declining,
duplicate clicks, invalid/older versions and waiting for SDK shutdown, including
shutdown failure. Profile tests reject mixing the NG and test ZIP identities.

`node build/testSdkIsolation.js` independently exercises the real pinned SDK
with an unfunded local test wallet, including restart and address persistence.
These tests do not establish an installed upgrade through a published GitHub
release or Windows code-signature verification.
