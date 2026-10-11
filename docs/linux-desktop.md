# Linux desktop prerelease

The [0.54.0-rc.1 prerelease](https://github.com/kodxana/lbry-desktop-ng/releases/tag/v0.54.0-rc.1)
provides Linux x64 packages with the same SDK source revision as the Windows
build. The Linux SDK is pinned by SHA-256 in `build/sdk-candidate.json`.

## Run

Download `LBRY-Desktop-NG-0.54.0-rc.1-linux-x86_64.AppImage`, then:

```sh
chmod +x LBRY-Desktop-NG-0.54.0-rc.1-linux-x86_64.AppImage
./LBRY-Desktop-NG-0.54.0-rc.1-linux-x86_64.AppImage
```

AppImage requires the FUSE 2 compatibility library. On Ubuntu 24.04 its package
is `libfuse2t64`. A missing `libfuse.so.2` error refers to that system library.
The tar.gz package is an alternative that does not use FUSE:

```sh
tar -xzf LBRY-Desktop-NG-0.54.0-rc.1-linux-x64.tar.gz
./LBRY-Desktop-NG-0.54.0-rc.1-linux-x64/lbry-desktop-ng
```

Run as a regular user in a desktop session. The app needs the usual Electron
system libraries, including GTK 3, NSS/NSPR, GBM and ALSA. Minimal server/WSL
installations may not provide them. A working Chromium sandbox is required;
these packages do not disable it. ARM64 and older distributions are not
validated.

NG uses a separate profile at `~/.config/LBRY Desktop NG` by default, or below
`XDG_CONFIG_HOME` when set. An existing original LBRY wallet is not imported.
Use a fresh test wallet. The hub picker runs before wallet sync, and the
**Choose another hub** action remains available during sync.

Linux updates are manual through the GitHub releases page. The Linux build does
not enable the Windows installer/update path. Extract a new version separately
and close the previous NG instance before launching it. Reusing the same NG
profile retains its wallet and downloaded data.

## Rebuild and verify

Use Linux x64 and Node 16.20.2. Install the checked-in Yarn lock with
`node .yarn/releases/yarn-3.2.0.cjs install --immutable --mode=skip-build`, then
run `node node_modules/electron/install.js` to install Electron 17.2.0.

Download the release's `lbrynet-linux.zip` and extract `lbrynet`. Import it with
`node build/downloadDaemon.js /absolute/path/to/lbrynet`; the import verifies
its hash and writes an executable file. `node build/buildDesktop.js` runs setup,
update-fixture and real SDK isolation checks, compiles the app, then builds the
AppImage and tar.gz under `dist/ng-linux`.

The Linux packages were added after the Windows prerelease. Their exact desktop
commit and hashes are recorded in `LINUX-PROVENANCE.json` and `SHA256SUMS-linux`.
The original release tag, Windows packages and Windows verification files are
preserved. Use the Linux source commit linked by that provenance when rebuilding.

Testing uses Ubuntu 24.04 under WSL2, a virtual X display and a local regtest hub.
It covers Linux disk-space queries, hub selection, the packaged renderer,
settings-only startup without a wallet, an unfunded wallet, recovery from a
stalled hub and clean shutdown. See `VALIDATION-linux.md` in the release for
the artifact-specific results. Physical desktop environments, GPU decoding,
audio output, paid content, funded transactions and wallet encryption/backup UI
still need acceptance testing. Electron/Node modernization remains outstanding.
