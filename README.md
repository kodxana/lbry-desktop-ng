# LBRY Desktop NG

LBRY Desktop NG is a community-maintained fork of the original
[LBRY Desktop](https://github.com/lbryio/lbry-desktop), developed by LBRY Inc.
This project is maintained independently of LBRY Inc.; its changes and releases
are community work. Original authorship and MIT license notices are preserved.

The goal is to restore the original desktop application and integrate
[LBRY SDK NG](https://github.com/kodxana/lbry-sdk-ng), with tests for wallet
persistence, playback, downloads and shutdown.

## Current status

Restoration is in progress. The first development target is an isolated Windows
x64 compatibility build of Desktop 0.53.9 with the SDK NG Windows shutdown fix.
Its executable is named **LBRY SDK Test** and uses its own profile, wallet and
ports. It does not import an existing wallet or register itself as the default
LBRY application.

The current build retains Electron 17.2.0 and Node 16.20.2 as the compatibility
baseline. Modernizing the desktop runtime and dependencies is still required.
There are no published Desktop NG installers yet. Historical upstream binaries
do not contain this fork's integration changes.

See [build and launch instructions](docs/isolated-desktop-test.md) and the
[Windows validation record](docs/windows-sdk-validation.md). The validation
covers an unfunded light wallet, two free MP4 streams, playback controls, a
paused download resumed after restart, and clean shutdown. Paid content,
funded transactions, wallet encryption/backup UI, Linux and macOS remain outside
that acceptance coverage.

The inherited LBRY Inc. publishing workflow has been removed from this branch.
CI and a community release pipeline still need to be established. Build locally
with the documented `build:sdk-test` command; the ordinary upstream packaging
configuration has not been converted into a Desktop NG release configuration.

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
