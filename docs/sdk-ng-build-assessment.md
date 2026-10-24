# Building the original desktop with SDK NG

The isolated build is now implemented on this checkout's test branch. See
[the test-build instructions](isolated-desktop-test.md). The baseline below
records the initial, unmodified desktop assessment.

## Verified baseline (2026-10-11)

This checkout is the original `lbryio/lbry-desktop` at
`d14c9141db0bfa2db9b5dcf78fcaa72912cc767a` (desktop 0.53.9). It is separate
from the app project in `../lbry-desktop`.

The original dependency lock installed without changes. Both Webpack bundles
compiled, and electron-builder produced a Windows x64 unpacked application.
The packaged SDK file matches the published SDK NG 0.114.0rc4 Windows binary:

```
29660a88281bc24bc76557de2779b8a00537e689e35e767a850f646d27d4e94b
```

This establishes build and resource-packaging feasibility. The desktop has not
been launched or installed. Its metadata and compiled version check still expect
SDK 0.113.0, and its default profile/ports are unchanged. Do not use this baseline
package for compatibility testing until the isolation changes below are made.
No public fork, release or automatic update was created.

## Toolchain and build

The baseline used Node 16.20.2, the repository's Yarn 3.2.0, Electron 17.2.0,
and locked electron-builder 22.14.13. Node's archive was checked against the
official release SHA-256 list. These are the historical build versions;
modernizing the desktop runtime is separate restoration work.

Run from this checkout with the isolated Node installation on PATH:

```powershell
$env:PATH = 'F:\save_lbry\.tooling\node-v16.20.2-win-x64;' + $env:PATH
$env:YARN_ENABLE_SCRIPTS = 'false'
$env:YARN_ENABLE_GLOBAL_CACHE = 'false'
node .yarn/releases/yarn-3.2.0.cjs install --immutable --mode=skip-build
```

Skipping install scripts avoids the original postinstall downloading SDK 0.113.0.
Copy the independently hash-verified rc4 executable to `static/daemon/lbrynet.exe`.
Then build without publishing or signing:

```powershell
$env:ELECTRON_CACHE = 'F:\save_lbry\.tooling\electron-cache'
$env:ELECTRON_BUILDER_CACHE = 'F:\save_lbry\.tooling\electron-builder-cache'
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
node node_modules/electron/install.js
$env:NODE_ENV = 'production'
node --max_old_space_size=4096 node_modules/webpack/bin/webpack.js --config webpack.electron.config.js
node node_modules/electron-builder/out/cli/cli.js --win --x64 --dir --publish never --config.win.signAndEditExecutable=false --config.npmRebuild=false --config.directories.output=dist/rc4-assessment
```

Output: `dist/rc4-assessment/win-unpacked`. Evidence is in the sibling
`../ci-validation/desktop-official-{install,compile,package}.log` files and
`../ci-validation/desktop-official-assessment.json`.

## SDK integration change

1. Pin SDK 0.114.0rc4 in `package.json` and in the binary acquisition code.
   `ui/redux/actions/app.js` rejects a different SDK version in production;
   rebuild both bundles after changing the pin.
2. Replace `build/downloadDaemon.js`'s upstream ZIP assumptions with the community
   release's raw, versioned executables and pinned SHA-256 values. Verify the
   existing cached executable too, and retain it if replacement verification fails.
   The current version marker alone is insufficient.
3. Fix `electron/Daemon.js`: `LBRY_DAEMON` currently also supplies `headersPath`.
   Setting it to the rc4 executable therefore passes that executable as
   `--initial-headers`. The binary and optional header paths need separate handling.
4. Carry the SDK platform limits into the desktop test build: Windows x64,
   Linux x86-64 with glibc 2.36+, and Intel macOS 15+. ARM64 needs separate work.

## Isolated test build

Use a distinct desktop application ID and user-data directory, a new empty SDK
wallet, separate SDK data/download/config directories, and dedicated loopback API
and media ports. Set the desktop RPC endpoint in `ui/lbry.js` to that test SDK;
it currently defaults to `http://localhost:5279`. Refuse occupied test ports and
verify the spawned SDK's version before allowing normal app startup.

Disable updater activity and default `lbry://` protocol registration in the test
build. These live in `electron/index.js`; a development launch currently registers
the protocol on Windows too. Quit must stop and await only the SDK owned by this
test instance. Preserve existing desktop and wallet profiles throughout testing.

## Acceptance sequence

- Start with a fresh empty wallet; confirm header sync, addresses and zero balance.
- Exercise wallet encryption, incorrect-password rejection, unlock, backup and restart.
- Check search, resolve, free playback, seeking and completed downloads through the UI.
- Interrupt and resume downloads, disconnect/reconnect the wallet service, and retry failures.
- Test local blob hosting and quit during a transfer against the shutdown-fix candidate.
  Published rc4 does not include SDK PR #27.
- Verify clean desktop/SDK exit, no orphan processes, and persistence after restart.
- Repeat on Linux and Intel macOS before making cross-platform compatibility claims.

These checks do not establish paid-content, funded-transaction, account/cloud-service
or legacy-wallet migration compatibility. Those need separate acceptance evidence.
