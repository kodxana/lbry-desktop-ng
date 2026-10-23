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

`node build/testDependencyTypes.js` loads all 88 checked-in declaration files,
rejects duplicate module declarations and checks contracts for nine packages:
React Redux 9.3.0, Express 5.3.0, localForage 1.10.0, Prettier 3.9.10,
classnames 2.5.1, Chalk 6.0.1, Reselect 5.3.0, webpack 5.111.1 and
react-modal 3.16.3. These package versions require a contract review on upgrade.
Valid application patterns must pass and 53 incorrect contracts must fail,
including removed APIs, nullable storage results, wrong selector arguments,
unsafe compiler callbacks and invalid modal props. The Reselect 3, webpack 4
and older modal definitions are replaced. Seven more duplicate untyped
overrides are removed; other inherited untyped package stubs remain.

`node build/testDependencyContracts.js` checks connected Redux components and
thunk results, Prettier's promises, Express async error forwarding, wildcard
parameters and listen errors, and localForage's configuration, callback and
storage results. Storage runs in a private in-memory browser fixture; HTTP
binds only to loopback on an assigned port.

`node build/testRemainingDependencyContracts.js` checks the installed Reselect
and webpack APIs: string wallet balances, composed selectors, required and
optional parameters, cache invalidation and eviction, compiler output,
multiple compilers, missing-entry errors, fatal errors without stats, invalid
configuration and compiler shutdown. The renderer suite checks modal open/close
callbacks, their actual elements and close events, focus restoration and
Escape/overlay/confirmation choices. These checks run in Windows and Linux CI.

The declarations cover the desktop's APIs and the related contracts exercised by
these tests. Express includes a structural subset of HTTP types because Flow
no longer supplies Node declarations. Prettier covers formatting/configuration,
not plugin AST/printer authoring. This is not complete coverage of every upstream
API. Reselect covers the desktop's selectors with up to five inputs and three
arguments, using its built-in memoizers. Webpack covers the desktop compiler
and configuration surface, not arbitrary plugin authoring. Extend these
declarations and their fixtures when new callers need more. In particular,
localForage's implementation is the source of truth where
its bundled TypeScript definitions differ: missing keys are nullable, `clear`
resolves without a value, failure callbacks omit the result, undefined writes
become null, and configuration can return an error or a promise.

The first application pass replaces 346 fresh-object `Object.assign({}, ...)`
copies across 20 Redux and helper files with object spreads. Calls that mutate
an existing target are unchanged. The shared action helpers retain the original
state reference for unknown actions, which redux-persist relies on; handled
actions still shallow-merge partial state into a fresh object.

The renderer's state-update fixture checks those identities, merge order,
explicit undefined and symbol properties, persisted settings, wallet balances
and transaction entries, failed sends, update choices, password status, sync
retries and copied claim/comment/download maps. Existing wallet backup,
encryption, password migration and updater tests remain required.

**The application is not yet type-clean.** The full check now reports 3,214
application diagnostics and zero library-definition diagnostics, down from
5,051 application diagnostics before this pass (1,837 fewer). Missing export
annotations, mismatched state shapes, nullable results, exact-object rules,
old utility types and casts still need work. Inherited `any` stubs remain, so a
clean declaration check does not mean every dependency API is fully typed.

No application errors are baselined, suppressed or converted into a successful
exit. These counts describe this revision, not a baseline that permits new
errors. Full application checking remains outside the required CI gates and
commit hook; the tool and contract tests do not establish whole-app type safety.

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
- [React Redux connect API](https://redux.js.org/react-redux/api/connect)
- [Express 5 API](https://expressjs.com/en/5x/api/)
- [localForage implementation](https://github.com/localForage/localForage/tree/1.10.0/src)
- [Reselect selector API](https://redux.js.org/reselect/api/createselector/)
- [webpack Node API](https://webpack.js.org/api/node/)
- [react-modal props](https://reactcommunity.org/react-modal/)
- [Husky setup](https://typicode.github.io/husky/get-started.html)
- [lint-staged configuration and staging behavior](https://github.com/lint-staged/lint-staged)
