# Menus, tabs and search controls

The application now uses Ariakit 0.4.42 for menus, tabs and search comboboxes.
It supports React 17 through 19 and leaves styling to the application. The four
direct Reach dependencies and their transitive utilities are removed. React stays
at 17 in this change; other dependencies still need migration before React 18/19.

## Compatibility

The shared menu wrapper retains portal positioning, keyboard navigation and
the app's dark/light theme styles. Menu actions use `onClick`; router links use
Ariakit's `render` prop. The simulated mousedown workaround is removed because
Ariakit opens menus on click. Collection and notification triggers now sit outside
their navigation links. Popup events do not activate an enclosing claim card,
and menu links do not reload the renderer. Disabled actions remain inert.
Closed menus stay mounted, as they did with Reach, so rapid reopening retains
stable focus targets while the popup animation finishes.
Focus restoration checks the live open state, so a delayed callback from an
earlier close cannot steal focus after the menu has reopened.

Tabs retain their existing indexed API at all three callers. Each group has
distinct tab/panel IDs, automatic arrow-key selection and RTL navigation. Disabled
tabs are skipped. Hidden panels remain mounted so changing tabs does not discard
unsaved form fields. Native ResizeObserver measurements keep the underline aligned
when selection, labels or layout change; expandable comments use the same browser
API instead of Reach's rectangle polling.

Both search consumers use controlled input state. Selection runs once, including
repeated selections of the same command. Home/End move the text caret; Escape
clears the search state and dismisses suggestions, then blurs an empty search.
Search actions no longer contain nested buttons. Blocked-channel substring and
accent matching, LBRY URL navigation, tag search and the remote-search debounce
remain unchanged. Comment suggestions and Material UI tooltips are unchanged.

## Validation

`build/tests/accessibleControls.jsx` exercises production components and styles
in Electron with a disposable Redux/IndexedDB profile. It checks:

- Tab/panel associations, selection, keyboard focus, disabled tabs, RTL, independent
  groups, form submit prevention, retained drafts and underline geometry/resizing.
- Menu keyboard/mouse actions, independent IDs, dismissal and focus restoration,
  router links, nested card links, disabled actions and native Tab navigation.
  A deferred close/reopen test reproduces stale focus restoration without relying
  on runner speed.
- Search selection, text caret movement, input-method composition, Escape,
  blocked-channel matching, tag actions and LBRY navigation.
- Existing comment suggestions, tooltips and expandable content.

Dark/light menu captures are saved as `dist/ci/controls-dark.png` and
`controls-light.png`. Chromium focus emulation permits real focus and native
key events without showing the fixture window. External requests remain blocked;
search responses are controlled at the transport boundary.

The Windows/Linux wallet backup, encryption, saved-password migration, sandbox,
packaging and startup checks remain required, along with the hosted Windows
installed-upgrade workflow. No user wallet is used. Screen-reader acceptance and
macOS behavior still need manual testing.

References: [Ariakit menus](https://ariakit.com/reference/menu),
[tabs](https://ariakit.com/reference/tab),
[comboboxes](https://ariakit.com/reference/combobox), and
[package peer dependencies](https://www.npmjs.com/package/@ariakit/react/v/0.4.42).
