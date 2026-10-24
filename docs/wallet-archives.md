# Wallet archive dependency

The desktop pins adm-zip 0.6.1, upgraded from 0.4.16. The two production consumers
are the main-process wallet backup writer and the build helper that reads a
checksum-verified SDK artifact. No wallet format, encryption, password storage,
SDK pin or updater dependency changes are part of this upgrade.

## Compatibility

The [upstream releases](https://github.com/cthackers/adm-zip/releases) tighten
archive validation and extraction, including duplicate entry rejection and
bounded decompression. Extraction no longer writes through destination symlinks.
Directory extraction with `extractEntryTo(..., false)` now preserves nested paths;
the app does not use that API. The backup writer uses `addFile` and `toBuffer`,
and already rejects source symlinks before adding file bytes. SDK staging reads
the single expected executable with `getData` after verifying the artifact hash.

The new library requires Node 14 or later; both the build host and the embedded
Electron runtime use Node 24. No additional runtime shim is needed. Reading the
old writer's UTF-8 filenames without the ZIP UTF-8 flag remains supported. Newly
written filenames also pass an independent reader's standard decoding.

## Regression coverage

- `node build/testWalletBackup.js` reads and extracts a frozen 0.4.16 archive,
  checking exact paths and bytes. It validates new production backups with yauzl,
  a test-only independent reader, including Unicode, nested duplicate basenames,
  binary data, hidden files, empty files and directories. Existing cancellation,
  sender validation, destination, collision and partial-write checks still run.
- `node build/testSdkIsolation.js` creates an encrypted backup through the actual
  main-process service, verifies it independently, then restores it into another
  disposable SDK profile. Unlock, decrypt and restart must preserve wallet keys
  and addresses. All wallets are generated, unfunded fixtures.
- The renderer suites exercise wallet backups through the sandboxed preload,
  document rendering, saved-password migration and updater choices. Native
  password tests cover Windows DPAPI and an isolated Linux keyring.
- Windows and Linux CI fetch and read the pinned SDK artifact with the new ZIP
  reader, then build and smoke-test the packages. The separate hosted Windows
  installed-upgrade test checks RC3-to-candidate and candidate-to-candidate updates,
  encrypted wallets, saved passwords and clean SDK shutdown. Do not run that
  installer test on a personal workstation.

These tests do not cover every third-party ZIP variant or macOS. Wallet archive
creation remains synchronous and reads files individually; it does not provide
an atomic snapshot of a wallet being changed concurrently.
