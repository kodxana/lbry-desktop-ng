# State management dependencies

The desktop uses Redux 5.0.1, React-Redux 9.3.0, Redux Thunk 3.1.0,
redux-first-history 5.2.0, Redux Persist 6.0.0, its filter transform 0.0.22,
Reselect 5.3.0 and re-reselect 5.1.1. LocalForage remains at 1.10.0,
now pinned explicitly; the compression transform remains at 4.2.0.

Replacing connected-react-router removes its Redux 4/React-Redux 7 peer limits.
React-Redux 9 uses React 18's external-store subscription API. Redux Thunk 3
exports the named `thunk` middleware. Redux 5 requires string action types;
the application's actions already use strings. Reducers and persistence are
retained rather than rewritten as part of this dependency upgrade.

The store now owns navigation from startup, including while the SDK setup UI
is mounted. Redux history actions keep their existing names. The exported
history retains live memory-history `index` and `entries` getters for the back
and forward menus, mouse buttons and page titles. React Router 8.5.0 receives
the Redux location and action through its public `Router` API. The former
Router 5 private-context adapter is removed. There is still one authoritative
navigation state, with no synchronous rendering override in the application.
See [navigation](navigation.md) for the route and link migration.

Reselect 5 changes the default memoization to weak-map caches and adds development
checks. Selectors must treat inputs as immutable. Claim overlays now copy the
confirmed-claim map, and subscription sorting copies the stored array. Removing
a pending claim therefore cannot leave its fields in confirmed state. The
existing re-reselect URI/repost cache keys remain unchanged.

The filter transform now imports Lodash subpaths. Its obsolete Webpack aliases
are removed. These subpaths retain their CommonJS export shape, which the
legacy cookie store also requires during password migration and cookie expiry.

## Saved data

The LocalForage database, `persist:v0` key, compression format, transform order,
whitelist and `autoMergeLevel2` reconciliation are unchanged. There is no purge
or schema migration. Wallet persistence still contains only the public receive
address; balances, sync status and unsent transaction drafts are refreshed or
discarded at restart. Remembered passwords remain in the OS-protected store.

`node build/testRenderer.js` exercises the production store with IndexedDB in
separate fresh, legacy-fixture and restart windows. It checks old preferences,
subscriptions, playlists and playback state, new defaults, persistence filters,
pending/reposted claim caches, immutable sorting, thunk results and failures,
bulk actions, nested connected-component removal, unsubscribe and navigation.
The same suite covers wallet backup/encryption, remembered passwords and updater
choices through the actual components and preload bridge.

The hosted Windows installed-upgrade test adds compressed playback positions and
history to the published RC3's real LocalForage database, preserving its other
preferences. Both private NSIS upgrade hops must rehydrate and rewrite this data
without losing it. That test also verifies wallet keys, addresses, encryption,
OS-protected passwords, declined installation and SDK shutdown. It is restricted
to fresh hosted Windows runners and must not be run on a personal machine.

References: [Redux 5 and React-Redux 9 migration](https://redux.js.org/usage/migrations/migrating-rtk-2),
[Redux First History](https://github.com/salvoravida/redux-first-history),
[Reselect 5 changes](https://redux.js.org/reselect/introduction/v5-summary/).
