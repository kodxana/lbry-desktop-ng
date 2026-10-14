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

`yarn flow` still invokes the inherited Flow 0.97 type checker. It stalls on the
modern dependency tree and needs its own migration. It is no longer coupled to
`yarn lint` or every commit. The Hermes parser and Flow lint rules check syntax
and lint behavior; they do not replace whole-project type checking. Desktop,
renderer, native password, SDK backup/encryption and installed-upgrade regressions
remain required for dependency upgrades.

## References

- [ESLint flat-config migration](https://eslint.org/docs/latest/use/configure/migration-guide)
- [ESLint compatibility utilities](https://eslint.org/blog/2024/05/eslint-compatibility-utilities/)
- [Flow lint tooling](https://flow.org/en/docs/tools/eslint/)
- [Prettier 3 breaking changes](https://prettier.io/blog/2023/07/05/3.0.0.html)
- [Husky setup](https://typicode.github.io/husky/get-started.html)
- [lint-staged configuration and staging behavior](https://github.com/lint-staged/lint-staged)
