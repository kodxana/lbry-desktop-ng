# React and Material UI

This compatibility step moves the renderer from React 16.14 to 17.0.2 and
Material UI 5.8.7 to 9.5.0. Emotion moves to 11.14.0 (`react`) and 11.14.1
(`styled`). React DOM, `react-is` and the React type definitions use the same
React major. Reakit still constrains the next React upgrade; Reach has since been
[replaced with Ariakit](accessible-controls.md).

## Compatibility

Material UI 9 removes the old TextField input props and Autocomplete popper
component prop. The comment input now passes the supplied input refs, handlers
and accessibility attributes through `slotProps`, together with its own input
class, placeholder, length limit and disabled state. The suggestion popup keeps
its placement above the field. Free text is accepted as text; only selection of
an actual suggestion invokes the insertion handler.

MUI also stops reporting automatic highlight changes and gives free text
priority on Enter. Comment completion explicitly retains Enter/Tab selection
of the visible match, preserves text after the cursor, ignores IME composition,
and lets Tab navigate normally after the popup is dismissed. No selected value
is retained between completions.

React 17 defers passive effect cleanup. The Video.js lifetime uses a layout
effect so navigation still disposes the player, removes keyboard handlers and
cancels pending source detection before a late network reply can recreate it.
The existing immediate-unmount and delayed-source regressions remain unchanged.

Material UI recommends resolving `react-is` to the installed React version for
React 18 and earlier. The lockfile resolution prevents its newer default from
misidentifying React 17 elements.

React Hot Loader and its patched React DOM fork are removed. Development uses
`react-refresh` 0.19.0 and the Webpack plugin 0.6.3 with the existing hot
middleware. Refresh instrumentation is limited to UI modules in development;
production and Electron main-process modules have no refresh hooks. Hub setup
restores its mounted flag when effects rerun after a component edit.

Villain 1.0.9 still declares React 16 peers and has no newer npm release. Its
peer warning remains visible. The real comic viewer is exercised with React 17,
using a module-scoped adapter for its two obsolete Reakit animation hooks. The
[file chooser now uses native radio inputs](collection-controls.md), leaving
Reakit in the comic reader only. The adapter repairs the reader's
`unstable_stopAnimation is not a function` failure without changing its archive
decoder or shipping a second React/React DOM implementation. Tests use
the shipped archive worker and a generated CBZ: both pages must paint the
expected pixels, navigation must work, and a file-read failure must show an
error. This is limited compatibility evidence, not a declaration that its
entire old dependency tree supports newer React versions. It needs replacement
or maintenance before a further React upgrade.

## Validation

The renderer suite covers autocomplete mouse/Enter/Tab/Escape interaction,
text around the cursor, input refs and attributes, multiline/free text,
livestream send guards, tooltip hover/focus/dismissal, and portal cleanup.
Document fixtures render offscreen so the comic menu receives animation frames
while its test window is hidden; the same phase checks real PDF pixels.
Existing form, document, upload, navigation and persistence tests run on the new
React event system. Wallet backup/encryption, password migration/restart and
update consent/decline/shutdown tests remain required.

The development smoke test temporarily edits the hub setup heading and verifies
that Fast Refresh applies and reverses the edit without reloading the page or
losing the unsaved custom-hub input. It restores the source in `finally` and
refuses to overwrite a concurrent edit. Run this test with no other process
editing that component. CI also requires a clean source/lockfile diff afterward.

Windows and Linux run the renderer, native password storage, SDK isolation,
production packaging and packaged/development startup checks. Real Windows
installed upgrades run only on a disposable hosted runner, preserving the test
wallet's keys, encrypted password and saved preferences across restarts.

No personal wallet or funded transaction is used. macOS and exhaustive comic
formats, assistive technologies and third-party controls are outside these
fixtures.

References: [React 17](https://legacy.reactjs.org/blog/2020/10/20/react-v17.html),
[Material UI 6](https://mui.com/material-ui/migration/upgrade-to-v6/),
[Material UI 7 and react-is](https://mui.com/material-ui/migration/upgrade-to-v7/),
[Material UI 9](https://mui.com/material-ui/migration/upgrade-to-v9/),
[Fast Refresh plugin](https://github.com/pmmmwh/react-refresh-webpack-plugin).
