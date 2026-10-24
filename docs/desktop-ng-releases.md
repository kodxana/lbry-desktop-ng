# Desktop NG builds and updates

The first NG installer target is Windows x64. It bundles the SDK pinned in
[`build/sdk-candidate.json`](../build/sdk-candidate.json), including SDK NG
PR #27, the updated wallet hubs from PR #29, the header sync improvements from
PR #30, history progress from PR #31, and the pending PR #28 startup cancellation fix. The executable still
reports SDK `0.114.0rc4`, but the older public rc4
release is a different binary. Build and startup both verify the pinned SHA-256.

Linux x64 AppImage and tar.gz packages use the matching Linux SDK from that
same CI run. See [Linux desktop builds and validation](linux-desktop.md).

## Build locally

Use Node 24.21.0 and the checked-in Yarn 4.18.1. Follow the dependency and SDK
acquisition steps in [the test build guide](isolated-desktop-test.md), then run:

```powershell
node build/buildDesktop.js
```

This runs the update tests and real SDK wallet/restart tests, compiles the app,
and builds an NSIS installer under `dist/ng`. It does not publish or install it.
The current build version is `0.54.0-rc.3`. Expected release files are:

- `LBRY-Desktop-NG-0.54.0-rc.3-windows-x64.exe`
- `LBRY-Desktop-NG-0.54.0-rc.3-windows-x64.exe.blockmap`
- `latest.yml`

These builds are unsigned. A community signing identity has not been
configured. Source builds use the supported Electron 44.9.3 release;
the published RC3 still uses Electron 17.2.0. See the
[runtime migration](electron-runtime.md) for scope and installed-upgrade coverage.
Current Windows source builds require Windows 10 or later. The installer rejects
older versions before replacing an existing installation; the published RC3 is
unchanged.

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
On an installed RC, the updater also considers the newest stable release so
users can graduate from testing without changing their preference. See the
[packaging/updater migration](packaging-updater.md) for compatibility checks.
Downgrades are disabled. Missing releases and network/download errors leave the
desktop running. Help shows the result of the most recent update check.
Linux uses the GitHub releases page for manual downloads; Linux automatic
updates are not enabled. macOS packaging and updates remain unvalidated.

## Preparing a release

1. Bump `package.json` to a higher SemVer version, rebuild, and verify the SDK pin
   and update tests. Use a tag matching the version, such as `v0.54.0-rc.1`.
2. Upload the installer, its blockmap and `latest.yml` together to a release in
   this fork. Keep candidate releases marked **Prerelease**. The pinned updater
   reads `latest.yml` inside the selected release even for prereleases.
3. Check an installed version upgrading to a later version on a disposable
   Windows profile before promoting it. Verify wallet persistence, clean SDK
   shutdown, application restart, and the new bundled SDK hash.

The SDK candidate was built by GitHub Actions. Its exact `lbrynet-windows.zip`
is also preserved as an asset of the Desktop NG prerelease, so rebuilding does
not depend on the expiring Actions artifact. `SDK-CANDIDATE.json` records the
original CI provenance and archive/executable hashes. Do not substitute the
older SDK rc4 release just because its version string matches.

## Published Windows prerelease

[0.54.0-rc.1](https://github.com/kodxana/lbry-desktop-ng/releases/tag/v0.54.0-rc.1)
was published manually from desktop commit
`9f23f440d9aec68eba8b21a475f70311cfa39347`. The tag points to that tested source;
the restoration PR remains open. The release contains the installer, blockmap,
`latest.yml`, SDK archive, candidate manifest, `SHA256SUMS`, `provenance.json`
and `VALIDATION.md`.

All eight public assets were downloaded without authentication and matched
their recorded SHA-256 hashes. The pinned GitHub updater provider resolved the
public prerelease and the expected installer URL, size and SHA-512 metadata.
This verifies discovery and downloads; an installed old-to-new upgrade remains
outstanding. A desktop CI release workflow and signing setup remain separate
work. Future builds must use a new version and tag, preserving these assets.

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

## Installed Windows upgrade acceptance

The `Installed Windows upgrade` workflow runs real NSIS installers on a fresh
GitHub-hosted Windows runner. `node build/testInstalledUpgrade.js` refuses local
or self-hosted execution, an existing NG profile, or an existing NG installation.
It must never be pointed at a personal wallet. The runner's dedicated NG profile
contains a newly generated, unfunded regtest wallet connected to a loopback hub.

The test installs the published RC3 executable after verifying its recorded
SHA-256, then performs two upgrades. Temporary versions `0.54.0-rc.4.upgrade-test`
and `0.54.0-rc.5.upgrade-test` are compiled from the current checkout, packaged
with the production NSIS configuration, and never published. `package.json` is
restored after each build. The first hop exercises the released updater; the
second exercises the current main-process IPC controller.

Manual test launches expose ephemeral loopback renderer and main-process debugger
ports. The external test helper is loaded through the main-process inspector;
the application ships no fixture IPC or renderer-to-main module loader. Both
debugger connections close at installer handoff, and NSIS's automatic restart
is observed before relaunching for verification. This also works with RC3 without
requiring `@electron/remote` in the candidate.

For each hop, the test holds the actual installer download, declines installation,
finishes the download and verifies that the app and SDK stay running. Explicit
acceptance then runs the real installer only after all owned SDK processes have
exited. It verifies replacement of the installed archive, automatic `--updated`
restart, the bundled SDK hash, the same wallet keys and addresses, encryption,
desktop storage, root/default-path cookies written by RC3's original adapter,
recovery of the OS-protected remembered password, and subsequent
clean shutdown. Uploaded JSON records contain assertions and hashes, not wallet
files, browser profiles or passwords.

Two test adaptations are deliberate: a loopback generic update feed supplies the
private installers and their SHA-512 metadata, and the real updater receives
silent-install mode so CI needs no wizard operator. Production still requests
the normal interactive installer. GitHub discovery is covered separately by the
provider tests. This acceptance does not cover wizard interaction, SmartScreen,
code signing, machine-wide/elevated installs or Windows accounts with real funds.
