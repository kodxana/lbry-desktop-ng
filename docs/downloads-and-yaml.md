# Downloads and YAML dependencies

| Package | Previous resolved version | Current |
| --- | --- | --- |
| node-fetch | 2.6.7 | 3.3.2 |
| js-yaml | 4.1.0 | 5.5.0 |

Remove the unused LBRYFirst downloader, old release-signing script and inactive
sandbox stub, along with the direct decompress, del, node-wget and sudo-prompt
dependencies and obsolete Flow stubs. The active NG release workflow and SDK
pin remain unchanged. The main process now retains Electron's native fetch
instead of replacing it through the inactive sandbox stub. The Babel-register
test loads the real devtools module without installing extensions.

## Compatibility

node-fetch 3 is an ES module. The pinned Node 24.22.1 runtime can require its
synchronous module graph; download scripts select the default export. Replace
the removed timeout option with AbortSignal deadlines covering both headers and
response bodies. Binary downloads use arrayBuffer and preserve their bytes when
converted to Buffer. Existing byte limits, source verification, SHA-256 checks
and atomic SDK staging remain in place. GitHub credentials are sent only to the
API, not to the signed artifact download URL.

js-yaml 5 rejects empty input in load and removes implicit merge-key support.
The actual hub-config reader uses loadAll with CORE_SCHEMA plus mergeTag,
retaining empty/comment-only files and merged hub defaults. It still rejects
multiple documents, malformed YAML and invalid endpoints. Explicit empty hub
lists remain empty. This reader does not rewrite users' SDK or wallet files.
Uncommon YAML tags outside the core schema and merge keys are not supported by
this reader; the SDK remains responsible for interpreting its other settings.

SDK settings and updater metadata retain their string, boolean and numeric
types, including Unicode paths and checksum strings. Independently resolved
updater parsers keep their own compatible versions; no global YAML resolution
override is applied.

## Validation

- The new tests in build/testArtifactDownload.js and build/testYaml.js were
  first exercised against the previous libraries. The downloader tests run the
  actual script with a local HTTP server and synthetic ZIP, checking binary
  bytes, credential handling, source/hash validation, size limits, stalled
  headers/bodies and interrupted transfers. Every failure preserves the previous
  SDK file without partial staging files.
- YAML tests cover empty and merged hub configuration, invalid input, SDK path
  and setting types, and release metadata read by the updater's separate parser.
  Both tests run in the full desktop service suite on Windows and Linux.
- The existing native password and renderer suites cover password migration,
  restart/recovery/forget, wallet backups and encryption, and update choices.
  SDK isolation tests use disposable, unfunded wallets and restore backups.
- Production package checks validate SDK bytes, updater metadata and exclusion
  of removed runtime dependencies. Packaged and development startup tests check
  the main-process SDK connection after removal of the old fetch override.
- The hosted Windows upgrade workflow tests the published RC3 installer and
  two upgrade hops, retaining wallet/password state and exercising decline,
  install and SDK shutdown. It must not run on a developer's normal profile.

The inherited Flow 0.97 parsing stall remains unresolved; focused ESLint and
runtime tests are not a claim of a clean full Flow check. Local Windows tests
use disposable profiles. Linux and installed-version upgrade checks run in CI.

References: [node-fetch v3 migration](https://github.com/node-fetch/node-fetch/blob/main/docs/v3-UPGRADE-GUIDE.md),
[js-yaml v5 migration](https://github.com/nodeca/js-yaml/blob/master/docs/migrate_v4_to_v5.md),
[js-yaml changelog](https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md).
