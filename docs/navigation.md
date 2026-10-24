# Desktop navigation

React Router 8.5.0 replaces version 5.3.4. Imports now come from `react-router`;
the separate `react-router-dom` package is removed. The installed React 19.3.1
and Node 24.21.0 meet version 8's requirements.

`DesktopRouter` supplies the Redux location and action to the public `Router`
component. It no longer imports private router contexts. The app's
`useDesktopHistory` hook and `withDesktopRouter` binding share the existing
store-owned history, including navigation before SDK startup. Components that
read `history.location` still subscribe to location changes.

History is now 5.3.0. It owns the active location and memory index; the desktop
keeps separate menu records because locations are immutable and History 5 no
longer exposes its entries. Only accepted pushes and replacements update those
records. Back/Forward preserves titles, and pushing after Back discards the
forward branch. Relative desktop destinations still resolve against the current
page's folder. Redux First History supplies the existing Back/Forward aliases.

Listeners receive `{ location, action }`. Playback callers pass navigation state
as the second argument, preserving playlist autoplay and floating-player flags.
Object queries include their leading `?`, and error recovery explicitly replaces
the current path with `/`. Blocking uses History 5's transition callback: leaving
it blocked declines navigation; unblocking and calling `retry()` accepts it.

Routes now use `Routes` and `element`. Setup takes precedence before matching
app routes. Static routes rank ahead of content paths; prefix routes explicitly
include `/*`. Discovery categories retain separate page instances so changing
categories does not overwrite saved sort preferences. Collection pages get
their ID from `useParams`. The old
`PrivateRoute` merely forwarded router props and did not perform authorization;
removing it changes no access policy.

Old bookmarks and repost/collection redirects use `Navigate replace`, so Back
does not loop through a redirect. Decoding an encoded LBRY path preserves query,
hash and navigation state, and a literal percent no longer throws in that
normalization step. Navigation buttons use `end` and a class callback for their
existing active styling. App buttons still translate `lbry://` links to desktop
content paths.

`testDesktopHistory.js` checks menu titles, forward-branch removal, relative paths,
query/hash/playback state, listener ordering and declined/retried transitions.
`testDesktopRoutes.js` checks the production route definitions with real React
Router matching and stubbed page bodies. The Electron renderer suite exercises
real links, redirects, Redux consistency, history menus, blocking/unsubscription,
query/hash/state, collection playback, category preferences and cancelled/modified
clicks. Existing wallet archive, encryption, password migration/restart and updater suites run with disposable
profiles. Installed NSIS upgrades run only on fresh hosted Windows runners.

References: [v5 migration](https://reactrouter.com/6.30.1/upgrading/v5),
[v8 requirements and changes](https://reactrouter.com/upgrading/v7),
[public Router API](https://reactrouter.com/api/declarative-routers/Router),
[NavLink](https://reactrouter.com/api/components/NavLink),
[History 5 API](https://github.com/remix-run/history/blob/main/docs/api-reference.md),
[blocked transitions](https://github.com/remix-run/history/blob/main/docs/blocking-transitions.md).
