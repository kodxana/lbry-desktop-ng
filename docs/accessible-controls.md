# Menus, tabs and search controls

This batch aligns the active Reach components and updates both local search
consumers while retaining React 16.14 and the application's existing styles.

| Package | Previous lock | Updated |
| --- | --- | --- |
| `@reach/combobox` | 0.12.1 | 0.18.0 |
| `@reach/menu-button` | 0.8.6 | 0.18.0 |
| `@reach/rect` | 0.16.0 | 0.18.0 |
| `@reach/tabs` | 0.1.6 | 0.18.0 |
| `match-sorter` | 6.3.1 | 8.3.0 |

`react-is` 16.13.1 explicitly satisfies the new menu package's peer dependency.
The unused direct `@reach/utils` dependency and unused Reach tooltip package/CSS
are removed. The app's tooltip wrapper already uses Material UI. Reach's internal
utilities, portals and descendants now resolve together at 0.18.0.

## Compatibility

Reach 0.18 removes default exports and changes its module output. All application
imports already use named exports; the Webpack 5 build supports the new modules.
The older tabs package injected `isSelected` into its children. The shared tab
wrapper now reads `useTabsContext`, with explicit indexes at each of its three
callers, and uses the `useRect` options object to observe only the selected tab.
This retains the animated underline when selection, layout or label width changes.
Expandable comments now measure a stable inner content element instead of sharing
one ref between the outer wrapper and its clipped child. Measuring the collapsed
height could remove the expand button and cause repeated layout changes. Tests
cover short/long content, collapse/expand and content size changes.

Menus retain their `as={Link}` router integration and existing styling. Comboboxes
retain the blocked-channel substring threshold and the search bar's text, tag and
LBRY URL actions. Match-sorter 7 introduced typo matching and 8 reverted it; this
upgrade does not enable that broad matching behavior. Comment suggestions retain
their filtering, selection and surrounding text.

## Validation

`build/tests/accessibleControls.jsx` runs the production components in Electron
with actual styles and a disposable Redux/IndexedDB profile. It covers tab/panel
ARIA associations, focus, disabled tabs, editor submit prevention, underline
geometry and resizing; independent menu IDs, keyboard and mouse actions, dismissal,
focus restoration and routing; blocked-channel matching and clearing; search and
LBRY navigation; comment emoji insertion; and measured expandable comments.
Search service responses are controlled at the transport boundary and external
requests remain blocked. Chromium focus emulation lets the hidden test window
receive real DOM focus events without taking over the user's desktop.

The existing Windows/Linux wallet backup, encryption, saved-password migration,
sandbox, packaging and startup checks remain required, together with the hosted
Windows installed-upgrade workflow. No user wallet is used.

Reach 0.18 is an interim compatibility pin, not a maintained long-term UI stack.
Its peer range stops at React 17; replacing it belongs with the later React
migration. Screen-reader and manual desktop acceptance are not automated here.

References: [Reach tabs API](https://reach.tech/tabs/),
[Reach source and release notes](https://github.com/reach/reach-ui),
[match-sorter 8 migration](https://github.com/kentcdodds/match-sorter/releases/tag/v8.0.0).
