# Package manager and dependency security maintenance

Yarn 4.18.1 replaces the checked-in Yarn 3.2.0 binary. Build commands, CI,
disposable hook tests and contributor instructions use the same pinned release.
The version plugin is included in Yarn 4, so its separate old bundle is removed.
The project keeps the node_modules linker and local cache. Dependency lifecycle
scripts are disabled; the documented install also skips the root lifecycle.
Electron installation and SDK preparation remain explicit build steps.

The lockfile moves to Yarn 4's format and checksum representation. Existing
package patches remain applied. Immutable CI installs additionally validate
registry metadata and declared resolution ranges. The migration-generated
allow-all Git setting and zero-day age override are removed, retaining Yarn 4's
defaults of no approved Git sources and a one-day minimum release age.
See the [Yarn changelog](https://yarnpkg.com/advanced/changelog) and
[install options](https://yarnpkg.com/cli/install).

Electron moves from 44.7.0 to 44.9.3 on the same major line. This includes the
[compromised-certificate mitigation](https://github.com/electron/electron/security/advisories/GHSA-jr5w-w6x2-84p9)
and the subsequent [Chromium, V8 and rendering fixes](https://github.com/electron/electron/releases/tag/v44.9.3).
The SDK, app version and updater version are unchanged.

## Nested dependencies

The refresh stays within parent dependency ranges. It covers cache semantics,
process spawning, temporary files, document shims, semver, YAML, Lodash,
Underscore, source maps, HTTP parsers/clients, serialization, glob matching and
archive tooling. Re-resolving the old `node-gyp: latest` entry removes node-gyp 9
and its obsolete tar 6/download stack; the current resolution is 13.1.0. Electron
rebuild retains its separately declared node-gyp 12 range.

The obsolete flow-typed download CLI is removed with its Git/GitHub clients.
The Flow checker and all maintained declarations remain required. See
[maintaining declarations](lint-tooling.md#flow-is-separate).

On 2026-10-24, querying the same npm bulk-advisory endpoint with the old and new
lockfile versions produced this comparison (unique registry advisory IDs, not
duplicated dependency paths; the 84 records cover 69 package/advisory URLs):

| Severity | Before | After |
| -------- | -----: | ----: |
| Critical |      3 |     0 |
| High     |     47 |     2 |
| Moderate |     25 |     0 |
| Low      |      9 |     0 |
| Total    |     84 |     2 |

The two remaining findings belong to the deliberately pinned
`electron-updater-legacy` 4.6.5 fixture and its builder-util-runtime 8.9.2 dependency.
It exercises compatibility with old published installers using local HTTP
fixtures. It is not the application's updater. Package checks reject the legacy
alias and any nested old updater/runtime copy in the shipped ASAR. Registry
deprecation notices are separate from these advisory counts; a small audit count
does not establish that every reachable code path is secure.

## Validation

The package-manager regression checks the actual pinned CLI, bundled version
plugin, local dependency installation, lifecycle suppression, unchanged
immutable installs and refusal to rewrite an out-of-date lockfile. Existing
hook tests cover partial staging, long Windows paths and failing checks.

Required checks include full Flow, lint, real renderer tests, native password
storage, encrypted SDK backups and restoration, updater consent/shutdown,
Windows/Linux packaging, development startup and real installed Windows
upgrades. All profiles and wallets are disposable and unfunded. macOS and funded
transactions are outside this batch.
