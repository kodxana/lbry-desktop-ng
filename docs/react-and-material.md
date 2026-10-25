# React and Material UI

The renderer now uses React and React DOM 19.3.1, Material UI 9.5.0,
Emotion 11.14.0 (`react`) and 11.14.1 (`styled`). `react-is` is pinned to
19.3.1 and the React types to 19.3.0. Reach has been
[replaced with Ariakit](accessible-controls.md), and the
[comic reader migration](comic-reader.md) removes Villain and Reakit.

## Compatibility

The application starts with `createRoot`. Promise, timer and native-event
updates therefore use automatic batching. Tests also use modern
roots; only fixture mounting and discrete input helpers flush synchronously
to let assertions inspect a settled user action. A separate test verifies
actual promise batching without a synchronous override. Strict Mode is not
newly enabled across the legacy application.

Encryption and unlock dialogs now await the result of their own SDK request.
A fast request can otherwise batch pending and completed Redux updates into
one render, hiding the status transition that the old dialogs relied on.
The actions retain the same Redux events and additionally return a boolean
result. Immediate submission guards prevent overlapping requests, and password
storage uses the submitted password/opt-in snapshot. Leaving before completion
prevents a late result from saving credentials or closing a later modal.

The renderer uses React-Redux 9.3.0, Redux 5.0.1, Redux Thunk 3.1.0 and
@hello-pangea/dnd 18.0.1 for collection drag-and-drop. React Router is now
8.5.0; its route migration is described in [navigation](navigation.md), and
its Redux binding in [state management](state-management.md).

React 19 requires the automatic JSX transform, enabled in the shared Babel
configuration for production, development and real renderer tests. The remaining
function-component default uses a parameter default so truncated titles keep
their tooltips. The thumbnail wrapper uses Flow props instead of ignored
`propTypes`, removing the application's direct dependency. Class defaults remain
supported. Viewer ref callbacks assign their nodes without returning a value,
reserving return values for React 19's ref cleanup functions.

React 19 reports caught rendering errors without rethrowing them. The existing
error boundary still reports through the opt-in diagnostics handler and offers
page recovery; its test uses stubbed diagnostics and a deliberate rendering
failure. No new error collection or Strict Mode behavior is enabled.

React Awesome Lightbox 2.0.0 needs React 18 and changes its default to a portal.
The app keeps it inline inside its existing modal so focus and background
accessibility stay in one boundary. The outer modal no longer handles Escape;
the viewer first resets a transformed image, then closes on Escape. The
backdrop-filter fix uses an explicit modal class because the library renamed
its body class. Zoom is now capped at the library's default 10×.

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

The lockfile keeps `react-is` on the same version as React, including for Material
UI's transitive import. Compiler tests verify element recognition through both.

React Hot Loader and its patched React DOM fork are removed. Development uses
`react-refresh` 0.19.0 and the Webpack plugin 0.6.3 with the existing hot
middleware. Refresh instrumentation is limited to UI modules in development;
production and Electron main-process modules have no refresh hooks. Hub setup
restores its mounted flag when effects rerun after a component edit.

This step originally used a module-scoped adapter for Villain's obsolete Reakit
animation hooks. The later [comic reader migration](comic-reader.md) removes that
adapter and both dependencies, replacing their UI with the app's controls while
upgrading the archive decoder and image viewer. The
[file chooser uses native radio inputs](collection-controls.md).

## Validation

The renderer suite covers autocomplete mouse/Enter/Tab/Escape interaction,
text around the cursor, input refs and attributes, multiline/free text,
livestream send guards, tooltip hover/focus/dismissal, and portal cleanup.
Document fixtures render offscreen so the comic menu receives animation frames
while its test window is hidden; the same phase checks real PDF pixels.
Existing form, document, upload, navigation and persistence tests run on the new
React event system. Wallet backup/encryption, password migration/restart and
update consent/decline/shutdown tests remain required.

The React runtime fixture checks tooltip defaults, error recovery, promise
batching, consistent router/Redux locations, back/forward history titles,
replacement, navigation blocking and subscription
cleanup. It also checks fast saved-password unlock, fast encryption after an
earlier success, duplicate submission and leaving while a request is pending.
Lightbox checks cover decoding, zoom, rotation, native Escape/Tab behavior,
focus restoration, background accessibility and broken-image dismissal.

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

References: [React 19 migration](https://react.dev/blog/2024/04/25/react-19-upgrade-guide),
[React 19.3.1 release](https://github.com/react/react/releases/tag/v19.3.1),
[Lightbox 2 migration](https://github.com/theanam/react-awesome-lightbox#-migrating-from-1x),
[Material UI 6](https://mui.com/material-ui/migration/upgrade-to-v6/),
[Material UI 7 and react-is](https://mui.com/material-ui/migration/upgrade-to-v7/),
[Material UI 9](https://mui.com/material-ui/migration/upgrade-to-v9/),
[Fast Refresh plugin](https://github.com/pmmmwh/react-refresh-webpack-plugin).
