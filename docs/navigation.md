# Desktop navigation

React Router 8.5.0 replaces version 5.3.4. Imports now come from `react-router`;
the separate `react-router-dom` package is removed. The installed React 19.3.1
and Node 24.21.0 meet version 8's requirements.

`DesktopRouter` supplies the Redux location and action to the public `Router`
component. It no longer imports private router contexts. The app's
`useDesktopHistory` hook and `withDesktopRouter` binding share the existing
store-owned history, including navigation before SDK startup. Components that
read `history.location` still subscribe to location changes.

History 4 remains in this batch. Its memory entries, titles, relative pushes,
listeners and blocking API are used by the desktop or its regression tests;
History 5 removes or changes those interfaces. Migrating that package needs a
separate review of desktop navigation rather than a version-only change.

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

`testDesktopRoutes.js` checks the production route definitions with real React
Router matching and stubbed page bodies. The Electron renderer suite exercises
real links, redirects, Redux consistency, history menus, blocking/unsubscription,
query/hash/state, category preference isolation and cancelled/modified clicks. Existing wallet archive,
encryption, password migration/restart and updater suites run with disposable
profiles. Installed NSIS upgrades run only on fresh hosted Windows runners.

References: [v5 migration](https://reactrouter.com/6.30.1/upgrading/v5),
[v8 requirements and changes](https://reactrouter.com/upgrading/v7),
[public Router API](https://reactrouter.com/api/declarative-routers/Router),
[NavLink](https://reactrouter.com/api/components/NavLink).
