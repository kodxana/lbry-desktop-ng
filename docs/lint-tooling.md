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

`node build/testDependencyTypes.js` loads all checked-in declaration files,
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

The shared UI pass replaces internal `React$Node` references with the public
`React.Node` type and adds explicit icon, sticker and display-component exports.
Icon props preserve optional size/color defaults, nullable titles and SVG refs.
The icon builder's separate ref parameter is excluded from its ordinary props.

`node build/testUiTypes.js` checks twenty-two actual UI/constants/formatter/editor-type source
modules in an isolated project with the real classnames/i18n declarations and installed UUID
package. Valid callers must pass; 37 invalid icon, sticker, component, backup and editor
contracts must fail. The renderer also mounts every registered icon and checks
ref forwarding, default/explicit size and color, title removal, unknown-icon
fallback and free/paid sticker data. The original shared UI pass changed
annotations only; compiling JSX and stripping Flow produced identical runtime
JavaScript to the previous revision.

The utility pass gives the number/credit/byte/string/time helpers and wallet
snapshot/progress functions explicit contracts. The credit formatter is now
checked rather than treated as an untyped module. SDK amounts remain strings,
failed status reads remain nullable, and the balance read still waits for status.
Credit display text is kept separate from its rendered React content.

`node build/testUtilityTypes.js` checks twelve real utility source files, the
throttle hook and the search and comment constants with the first-party declarations. It rejects 61 invalid
formatting, progress, wallet snapshot, search, homepage, comment and collection contracts. The UI gate also
checks credit display props and defaults.
`node build/testUtilityContracts.js` covers formatter caching, locale changes,
tiny amounts, display rounding versus transaction serialization, bytes and time.
Wallet tests exercise pending and rejected status/balance reads; renderer tests
exercise tiny credits, fiat values, plus signs, raw amounts and missing values.

The formatter types exposed an optional collection-update bid being converted
into the string `"NaN"`. An absent bid now stays absent in the JSON request,
which makes the SDK retain the existing claim amount. Explicit bids, including
zero and tiny amounts, retain their previous serialization; SDK validation is
unchanged. A payload regression covers manual and background collection updates
without submitting transactions. It fails against the previous implementation.

The search pass types query strings, cached result objects, nullable recommendation
headers, pagination markers and loading state. Literal search option keys are
checked against the same constants used by the application. The query gate
rejects invalid option values and callers that assume optional results exist.

`node build/testSearchContracts.js` exercises real helpers, reducers, selectors
and actions with mock responses: filter serialization, LBRY links, cached pages,
deduplication, empty pages, missing provider headers and failed requests.
Renderer tests cover search loading, stale responses, unmounting and filter
controls. Simplified filters no longer delete shared Image/Other options, and
custom selection callbacks receive an empty string when no suggestion matches.
The legacy URI parser and broader claim-selector state types are unchanged.

The homepage pass replaces duplicate row definitions with shared category, feed
option and row contracts, used by the homepage and navigation consumers.
`node build/testHomepageContracts.js` checks the actual builders and homepage:
category routes, channel limits, release windows, localization, personalized
tags and channels, and unchanged configuration. Stale subscription URIs are
skipped; if no valid channel IDs remain, the Following row is omitted so its
empty filter cannot fetch unrelated content. The new regression fails against
the previous builder. The URI parser itself is unchanged.

The comment pass types selector results, reaction counts, moderation maps,
mentions and sticker helpers. `node build/testCommentContracts.js` uses the real
reducers, selectors and helpers to check immutable moderation lists, missing
records, pagination, visibility rules, ownership exceptions, mentions, sorting
and sticker parsing. The moderation regression fails against the previous
implementation, which reversed the Redux array in place. Ownership checks now
read the raw claim-ID array's length rather than a Set's `size`. Missing records
are skipped without changing stored ID lists or server pagination totals.

The collection pass types selector results, nullable entries, last-used IDs,
server counts, shuffle state and repeat navigation. `node build/testCollectionContracts.js`
checks real selectors, reducers and actions for ownership, collection precedence,
missing IDs, aliases, counts, shuffle membership, saved edits before resolution
and bounded navigation. The previous repeat search hangs when no entry can play;
the new search examines at most one pass through the list. Missing-item indices
are consistently `-1`, and renderer tests verify that all reorder buttons are
disabled for them. The existing reorder and persistence tests still run.

The comment-input pass types suggestion state, textarea refs, completion events,
emote results and the throttle hook. `node build/testCommentSuggestions.js` checks
caret ranges, repeated and mixed tokens, Unicode, channel IDs and text preservation.
Electron tests cover keyboard/mouse completion, IME, dismissal, multiple tokens,
punctuation and throttled input cleanup. Completion no longer skips punctuation
after an inserted emoji. The suggestion grammar and search delay are unchanged.

The form-control pass types render results, defaults, native element refs,
forwarded input props, price callbacks and the CodeMirror/EasyMDE surface used
by the Markdown field. Price callbacks use arrow fields instead of casts and
manual binding. Source checks cover optional/default props, price values,
change objects and editor positions/options. Renderer regressions exercise
focus, checkbox labels, textareas, validation messages, submission, disabled
controls, amount clearing, eight-decimal amounts and currency changes. Existing
Markdown tests retain draft, undo, live-limit, preview and cleanup coverage.
The field, row, form and submit changes produce unchanged runtime JavaScript.

The claim pass shares the reducer state with selectors and distinguishes stream,
channel, collection and repost values. A focused source gate checks nullable
lookups, metadata field types, pagination and ownership, rejecting 21 invalid
contracts. The generic metadata signature lives in the declaration file so both
the current Flow checker and the production Babel parser can consume it.
Regression fixtures cover pending/reposted claims, immutable ordering, purchase
filtering, numeric bids, missing action inputs and moderation identity after a
signing failure. Support abandonment tests use a mock SDK; renderer tip tests
use callbacks that never submit transactions. Channel updates require the saved
metadata before replacing it, preserving location fields not exposed in the form.

The renderer pass adds explicit return types across components, modals and pages,
and local state types for wallet, setup, publishing and media controls. Empty
values remain distinct from loaded values; initialization and UI behavior are
preserved. Modal props include the forwarded react-modal options. Backup fields
track mounting and the pending request ID, and the IPC call retains the generated
ID in a local constant. Production Babel output is unchanged for 311 of the 312
modified UI modules; only that small backup lifecycle adjustment emits different
JavaScript. The shared source gate now also checks the actual backup and modal
components, including missing settings, request IDs and accessible modal options,
against narrow presentation and IPC fixtures (37 invalid contracts in total).
Existing renderer tests cover cancellation, retry, profile changes and unmounting.

The API pass checks the actual SDK and comment clients in an isolated source
gate and rejects thirteen invalid caller contracts. SDK methods expose their declared
return types, claim resolution distinguishes claims from error responses, and
moderation block/unblock requests have separate parameter types. Runtime tests
cover JSON-RPC payloads and failures, startup retries, signed requests, partial
moderation results, preferences and saved-password selection. Encryption/decryption
sync waits for a successful wallet operation before exporting or uploading;
delayed operations and failures are covered using the actual wallet action code.
The transport still trusts method-specific payloads after parsing the RPC envelope;
these types do not provide runtime validation of every server response.

The Redux pass adds explicit return contracts to claims, collections, comments,
content and notification actions, and checks the claim/comment/notification
reducer state. The additional source gate uses the actual collection/notification
actions and three reducers with narrow dependency interfaces, rejecting eight
invalid contracts. Transaction outputs retain a typed first claim followed by
generic change outputs; comment parent IDs are strings and notification IDs are
numbers. Existing broad dispatch and untyped dependency boundaries remain.

Runtime regressions cover collection cache insertion, ordering, batching, mixed
claim types, partial failures and pending local edits; publish failure settlement,
eight-decimal bids and background edit parameters; notification failure loading
state and IDs; and comment reply/reaction/unblock state. Renderer tests cover
repost success, failure and cancellation without submitting transactions.

The publishing pass shares typed form state and partial updates across actions,
reducer and controls. Its source gate checks actual publishing actions, reducer
and SDK contracts against narrow selector/navigation interfaces, rejecting nine
invalid caller contracts. Native input refs, file paths, thumbnail callbacks,
license fields and release dates are typed. Unused filesystem upload adapters
are removed; both desktop thumbnail callers pass a browser File.

Runtime tests cover suggested-name defaults, preview/live payloads, eight-decimal
fees, metadata-only edits, publish failures and thumbnail service failures.
Renderer tests cover price conversion, confirmation/cancellation and full file
paths, custom license events, Markdown MIME fallback and real local-video PNG
capture. Publish selectors and the general dispatch boundary remain untyped.

**The application is not yet type-clean.** The full check now reports 1,221
application diagnostics and zero library-definition diagnostics, down from
1,363 before the publishing pass (142 fewer, with no newly introduced diagnostics).
Missing export annotations, mismatched state shapes, nullable results,
exact-object rules, old utility types
and casts still need work. Inherited `any` stubs remain, so a clean declaration
check does not mean every dependency API is fully typed.

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
