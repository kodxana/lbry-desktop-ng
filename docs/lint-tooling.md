# Lint and commit hooks

The desktop uses ESLint 9.39.5, Prettier 3.9.10, Husky 9.1.7 and
lint-staged 17.6.0 on the pinned Node 24 toolchain. ESLint 10 is deferred because
the current React, import and Flow plugins declare support through ESLint 9.

## Commands

- `yarn lint`: check `ui`, `electron` and `build`, including `.cjs` files.
- `yarn lint-fix`: apply available ESLint fixes to those directories.
- `yarn format path/to/file`: format the specified files.
- `yarn format:check path/to/file`: check formatting without writing.
- `yarn hooks:install`: install the Git hooks in this checkout.
- `yarn precommit`: run the staged-file checks manually.
- `node build/testLintTooling.js`: test linting, formatting and real commits in a
  disposable repository under `dist/lint-tests`.

Staged commands are split at 4,000 characters so large migrations also work
through Yarn's Windows command shims. The hook test commits an 80-file batch
whose full paths exceed the Windows shell's 8,191-character limit.

Hook installation is explicit. Yarn 3 does not use npm's `prepare` lifecycle,
and CI installs with lifecycle scripts disabled. Run `yarn hooks:install` after
installing dependencies in a new checkout, or when migrating from Husky 3.
It updates this checkout's `core.hooksPath` to `.husky/_`; the old generated
`.git/hooks` scripts are no longer used. CI runs linting and hook tests directly.

## Migration details

`eslint.config.cjs` replaces `.eslintrc` and `.eslintignore`. It retains the
existing correctness rules from Standard and the React Hooks checks. Prettier
owns formatting; its settings still use semicolons, single quotes, a 120-column
width and ES5 trailing commas. Formatting is applied only to files selected by
the developer or staged for a commit, with no repository-wide rewrite.

Hermes parses Flow/JSX; ESLint's default parser handles CommonJS. The maintained
`eslint-plugin-ft-flow` replaces `eslint-plugin-flowtype` under the existing
`flowtype` rule name so inline directives keep working. ESLint's official
compatibility adapter supports its legacy rule APIs. The existing global Flow
type treatment is retained, while undefined runtime identifiers still fail.
Unused parser, resolver, formatting and Standard plugins were removed.

The legacy account client imports `querystring`, previously supplied only by the
webpack resolver's dependency tree. It is now explicitly pinned to 0.2.1 so a
clean install still builds. Migrating that client's request encoding is separate
from replacing the developer tools.

The lint-staged configuration now uses the current top-level syntax. Each
JavaScript file is formatted and then linted in one task chain. lint-staged
handles staging itself; explicit `git add` commands are gone. Partial staging,
failed-hook restoration, paths containing spaces and Unicode, and actual Husky
commit rejection are covered on Windows and Linux.

The newer React rules exposed a custom DOM `uri` attribute and a forwarded Redux
`dispatch` prop. The attribute is now `data-uri`; dispatch is removed before the
DOM prop spread. The intentional `theme` attribute remains allowed only on the
two setup components whose stylesheet requires it. The saved-state fixture now
declares its props. The complete lint command has no errors; existing warnings
remain visible and are not blanket-suppressed.

## Flow is separate

Flow 0.337.0 and flow-typed 4.1.1 replace the inherited tools. `yarn flow` runs
the foreground `full-check` command with two workers and exits nonzero when it
finds errors. In this Flow release, `check` starts a server; on Windows that
server can keep a captured output pipe open after reporting results. The
foreground command finishes without starting a background server.

The configuration uses current project-relative ignore globs, excludes generated
output and the definition cache, removes unsupported suppression/proposal
options, and pins the checker version. `config` resolves to the desktop's
`configValues.js`; `lbryinc` resolves to the bundled account client instead of
the retired package's `any` stub. Forty-seven declarations for retired packages
are removed. Definitions for still-used packages are retained for migration.

`yarn flow-defs` installs available definitions without generating untyped stubs,
overwriting hand-written definitions or restarting Flow. Its cache stays in
`.yarn/flow-typed`. Review generated definitions before committing them: a
package/version match does not guarantee compatibility with the current checker.
The installer was also exercised against the actual package manifest with output
redirected to a disposable directory.

`node build/testFlowTooling.js` runs offline in the desktop regression suite. It
checks the real configuration with JSX, global storage types, desktop aliases,
optional chaining and ignored generated files. Incorrect types, invalid syntax
and incorrect calls through a custom definition must fail. It also exercises
flow-typed's public CLI and verifies that regenerating a modified definition is
rejected without changing the file.

`node build/testFlowContracts.js` adds a required check for all 31 first-party
global definition files. It loads the real declarations and action constants in
an isolated project. Valid SDK balances, download states, claim metadata,
notifications and search actions must pass; malformed fields and action payloads
must fail. Browser `Comment`, `Location` and `Notification` types are checked too.
Third-party `declare module` files are outside this gate; mixed global/module
files are rejected so new globals cannot silently escape it.

The shared types now explicitly preserve their original open-object contracts
under Flow's exact-by-default rules. SDK responses may include additional fields,
but declared fields still have to match their types, including string amounts.
Domain names no longer overwrite browser types. Action types use checked string
discriminants, the duplicate comment-pin definition is removed, and the SDK's
existing `items` response field is preserved. Download flags accept both states;
the notifications page uses the web notification format; search options use
their actual keys, with a separate action for mention results. These changes
affect annotations only, not application behavior.

**The application is not yet type-clean.** The full check now completes, but
reports thousands of diagnostics in application code and legacy definitions.
Missing export annotations, exact-object rules, old utility types, casts and
definitions for earlier React/Redux versions need a separate migration. No
application errors are baselined, suppressed or converted into a successful exit.
The tool and contract tests do not establish whole-app type safety. This first
migration batch reduces the full report from 5,694 to 5,307 diagnostics, including
32 fewer library-definition diagnostics. Legacy npm definitions and application
export annotations are the next work; inherited `any` types are not all removed.
Full application checking remains outside the required CI gates and commit hook.

Hermes and the Flow lint rules check syntax and lint behavior. Desktop, renderer,
native password, SDK backup/encryption and installed-upgrade regressions remain
required for dependency upgrades.

## References

- [ESLint flat-config migration](https://eslint.org/docs/latest/use/configure/migration-guide)
- [ESLint compatibility utilities](https://eslint.org/blog/2024/05/eslint-compatibility-utilities/)
- [Flow lint tooling](https://flow.org/en/docs/tools/eslint/)
- [Flow ignore-pattern migration](https://flow.org/en/docs/config/ignore/)
- [Flow legacy syntax migration](https://flow.org/en/docs/modernizing-legacy-syntax/)
- [flow-typed](https://github.com/flow-typed/flow-typed)
- [Prettier 3 breaking changes](https://prettier.io/blog/2023/07/05/3.0.0.html)
- [Husky setup](https://typicode.github.io/husky/get-started.html)
- [lint-staged configuration and staging behavior](https://github.com/lint-staged/lint-staged)
