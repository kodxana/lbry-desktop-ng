# LBRY Desktop NG

LBRY Desktop NG is a community-maintained fork of the original
[LBRY Desktop](https://github.com/lbryio/lbry-desktop), developed by LBRY Inc.
This project is maintained independently of LBRY Inc.; its changes and releases
are community work. Original authorship and MIT license notices are preserved.

The goal is to restore the original desktop application and integrate
[LBRY SDK NG](https://github.com/kodxana/lbry-sdk-ng), with tests for wallet
persistence, playback, downloads and shutdown.

## Current status

Restoration is in progress. Windows and Linux x64 builds bundle the pinned SDK NG
candidate with the Windows shutdown fix. **LBRY Desktop NG** has its own profile,
wallet and ports, and checks this fork's GitHub releases for updates. The
separate **LBRY SDK Test** ZIP keeps updates disabled for compatibility testing.
Neither build imports an existing wallet or replaces the original app's protocol
registration.

Before the first wallet sync, setup checks hub response times and offers
automatic selection, a responding hub or a custom address. Startup keeps a
**Choose another hub** button available if the selected server fails.
Windows storage checks use the native
disk-space API instead of WMIC. See [setup behavior and tests](docs/desktop-setup.md).

The current build retains Electron 17.2.0 and Node 16.20.2 as the compatibility
baseline. Modernizing the desktop runtime and dependencies is still required.
The [0.54.0-rc.1 prerelease](https://github.com/kodxana/lbry-desktop-ng/releases/tag/v0.54.0-rc.1)
is available for Windows and Linux x64 testing. Download the Windows installer
or Linux AppImage/tar.gz from its Assets list; see the [Linux instructions](docs/linux-desktop.md).
the other files provide updater metadata, checksums, SDK source provenance and
validation details. Historical upstream binaries do not contain this fork's
integration changes.

See [build and launch instructions](docs/isolated-desktop-test.md) and the
[Windows validation record](docs/windows-sdk-validation.md). The validation
covers an unfunded light wallet, two free MP4 streams, playback controls, a
paused download resumed after restart, and clean shutdown on Windows. Linux
setup and wallet checks are recorded separately in the Linux guide. Paid
content, funded transactions, wallet encryption/backup UI and macOS remain
outside that acceptance coverage.

See [NG installer and GitHub update instructions](docs/desktop-ng-releases.md)
for `build:ng`, release files, profiles and update tests. Current installers are
unsigned; an installed upgrade through a published release still needs acceptance
testing. The inherited LBRY Inc. publishing workflow has been removed. Desktop
CI, signing and a community publishing workflow remain to be established.

## Contributing

Focused bug fixes, tests and restoration work are welcome. Read
[CONTRIBUTING.md](CONTRIBUTING.md) and use this fork's
[issues](https://github.com/kodxana/lbry-desktop-ng/issues) and
[pull requests](https://github.com/kodxana/lbry-desktop-ng/pulls).

Related community projects: [SDK NG](https://github.com/kodxana/lbry-sdk-ng),
[Hub NG](https://github.com/kodxana/lbry-hub-ng), and
[RocksDB NG](https://github.com/kodxana/lbry-rocksdb-ng).

## License and credits

This project is MIT licensed; see [LICENSE](LICENSE). The original desktop,
design and Git history are credited to LBRY Inc. and its contributors.
LBRY Inc. download links, signing identities, support addresses and contribution
reward programs are not maintained by this fork.
