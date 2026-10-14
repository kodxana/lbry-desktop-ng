# Contributing to LBRY Desktop NG

This is an independent community restoration of the original LBRY Desktop.
Use [this fork's issues](https://github.com/kodxana/lbry-desktop-ng/issues) and
[pull requests](https://github.com/kodxana/lbry-desktop-ng/pulls).
Historical LBRY Inc. bounty and paid-contribution programs do not apply here.

## Development baseline

Start with [the isolated Windows build](docs/isolated-desktop-test.md).
It uses the checked-in Yarn lock, Node 24.21.0 and Electron 44.7.0. Runtime and
dependency upgrades should be separate, reviewable changes with evidence that
wallet persistence and SDK lifecycle behavior still work.

The renderer is React/Redux; `electron/index.js` owns application and SDK
startup/shutdown. The SDK itself is maintained in
[lbry-sdk-ng](https://github.com/kodxana/lbry-sdk-ng).

## Pull requests

- Describe the user-visible problem, the change, and how it was verified.
- Keep commits focused and use direct, descriptive commit messages.
- Preserve upstream license notices and authorship.
- Use a separate test profile and an unfunded wallet for compatibility checks.
  Never include wallet seeds, private keys, personal profiles or credentials.
- Run ESLint on changed JavaScript and JSX. For launcher or SDK integration
  changes, run `node build/testSdkIsolation.js` and build the packaged app with
  `node build/buildSdkTest.js`, using the pinned SDK candidate.
- Record the platform, SDK source/hash, test steps and remaining limitations.
  A successful build alone does not establish wallet or playback compatibility.

Run `yarn lint` for the application and test sources. It currently has no errors;
existing hook-dependency and console warnings remain visible. Do not suppress
checks to hide a regression. Run `yarn hooks:install` once per checkout to install
the staged-file checks, including after a dependency install with scripts skipped.
See [lint and commit hooks](docs/lint-tooling.md) for commands and the separate Flow
type-checking limitation.
Changes to packaging and release automation must retain the test application's
separate identity until a reviewed migration and release process exists.
