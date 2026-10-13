# Linux desktop prerelease

The [0.54.0-rc.3 prerelease](https://github.com/kodxana/lbry-desktop-ng/releases/tag/v0.54.0-rc.3)
provides Linux x64 packages with the same SDK source revision as the Windows
build. The Linux SDK is pinned by SHA-256 in `build/sdk-candidate.json`.

## Run

The bundled Linux SDK requires glibc 2.36 or newer. Ubuntu 24.04 is the current
test baseline; Ubuntu 22.04's glibc 2.35 cannot run this SDK binary.

Download `LBRY-Desktop-NG-0.54.0-rc.3-linux-x86_64.AppImage`, then:

```sh
chmod +x LBRY-Desktop-NG-0.54.0-rc.3-linux-x86_64.AppImage
./LBRY-Desktop-NG-0.54.0-rc.3-linux-x86_64.AppImage
```

AppImage requires the FUSE 2 compatibility library. On Ubuntu 24.04 its package
is `libfuse2t64`. A missing `libfuse.so.2` error refers to that system library.
The tar.gz package is an alternative that does not use FUSE:

```sh
tar -xzf LBRY-Desktop-NG-0.54.0-rc.3-linux-x64.tar.gz
./LBRY-Desktop-NG-0.54.0-rc.3-linux-x64/lbry-desktop-ng
```

Run as a regular user in a desktop session. The app needs the usual Electron
system libraries, including GTK 3, NSS/NSPR, GBM and ALSA. Minimal server/WSL
installations may not provide them. A working Chromium sandbox is required;
these packages do not disable it. ARM64 and older distributions are not
validated.

Hosts that restrict unprivileged user namespaces may require a root-owned SUID
`chrome-sandbox` helper. CI configures this for its unpacked test copy on the
Ubuntu 24.04 runner. This does not establish out-of-the-box AppImage startup under
every distribution's sandbox policy; that remains a release acceptance check.

NG uses a separate profile at `~/.config/LBRY Desktop NG` by default, or below
`XDG_CONFIG_HOME` when set. An existing original LBRY wallet is not imported.
Use a fresh test wallet. The hub picker runs before wallet sync, and the
**Choose another hub** action remains available during sync.

Linux updates are manual through the GitHub releases page. The Linux build does
not enable the Windows installer/update path. Extract a new version separately
and close the previous NG instance before launching it. Reusing the same NG
profile retains its wallet and downloaded data.

## Rebuild and verify

Use Linux x64 and Node 24.21.0. Install the checked-in Yarn lock with
`node .yarn/releases/yarn-3.2.0.cjs install --immutable --mode=skip-build`, then
run `node node_modules/electron/install.js` to install the pinned Electron 34.5.8.

For the current source, download `lbrynet-linux` from the CI run recorded in
`build/sdk-candidate.json`, verify its archive SHA-256 against
`artifacts.linux.archiveSha256`, and extract `lbrynet`. The SDK archived with
RC1 matches the older RC1 source only. Import the current binary with
`node build/downloadDaemon.js /absolute/path/to/lbrynet`; the import verifies
its hash and writes an executable file. `node build/buildDesktop.js` runs setup,
update-fixture and real SDK isolation checks, compiles the app, then builds the
AppImage and tar.gz under `dist/ng-linux`.

For the historical RC1 release, Linux packages were added after Windows. Their exact desktop
commit and hashes are recorded in `LINUX-PROVENANCE.json` and `SHA256SUMS-linux`.
The original release tag, Windows packages and Windows verification files are
preserved. Use the Linux source commit linked by that provenance when rebuilding.

Historical RC1 acceptance testing used Ubuntu 24.04 under WSL2, a virtual X display and a local regtest hub.
It covers Linux disk-space queries, hub selection, the packaged renderer,
settings-only startup without a wallet, an unfunded wallet, recovery from a
stalled hub and clean shutdown. See `VALIDATION-linux.md` in the release for
the artifact-specific results. Physical desktop environments, GPU decoding,
audio output, paid content, funded transactions and wallet encryption/backup UI
still need acceptance testing. Electron/Node modernization remains outstanding.

For RC3, Windows and Linux packages are built by the same Desktop CI run.
The release includes shared source provenance and checksums. See the
[password migration test guide](password-migration-testing.md) for upgrade
and keyring checks, and [desktop CI coverage](desktop-ci.md) for the current
automated wallet encryption, backup and migration tests.
