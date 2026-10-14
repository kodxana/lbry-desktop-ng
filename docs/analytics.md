# Desktop analytics dependencies

The desktop uses `@datapunt/matomo-tracker-js` 0.5.1 for the existing page and event
commands. It loads `matomo.js` only after sharing is enabled and both `MATOMO_URL`
and `MATOMO_ID` are configured. The saved `shareInternal` choice still applies at
startup; SDK settings continue to update that choice through `toggleInternal`.
This does not add a community tracking service or change the configured endpoint.

The 0.5.1 constructor rejects missing configuration. Its `disabled` option only
skips initialization, so it cannot enforce consent for later tracking calls. The
app instead creates one tracker lazily and gates every page, event and identity
call. It queues `requireConsent` before activity, grants consent when enabled,
and revokes it and clears the user ID when disabled. A script that has not loaded
yet loses queued activity on opt-out. Delayed version callbacks also pass through
the current sharing check.

Automatic heartbeat and link tracking are disabled. The checked-in Yarn patch
fixes the wrapper's `linkTracking: false`: upstream still called
`enableLinkTracking(false)`, which enables normal clicks in Matomo and only
disables middle/right-click tracking. The patch covers both the ES module used by
webpack and the CommonJS entry. Remove it when an upstream version skips this
call for `false`.

The Sentry browser dependency and webpack plugin were removed. There was no
Sentry initialization or DSN, and the plugin configuration was commented out.
The video error callback and unused error-boundary state for that inactive
integration were removed too. Video.js still displays playback errors; the
existing opt-in `desktop_error` API path is unchanged.

## Regression checks

`node build/testRenderer.js` runs the real wrapper in disposable Electron windows:

- Disabled startup, page/event/user calls and legacy API reporting stay inactive.
- Opt-in preserves page, campaign dimension, event and identity payloads.
- Opt-out before the script loads discards queued activity and delayed callbacks.
- The loaded-tracker command boundary receives consent revocation and identity
  reset; navigation and events after opt-out produce no commands.
- Repeated settings refreshes reuse one tracker; enabled and disabled choices
  survive a renderer restart. Missing URL or site ID does not break startup.
- The patch prevents automatic link tracking and heartbeat registration.
- The network audit blocks every external request. Only the two opted-in test
  windows may attempt to fetch the configured tracking script; all other windows
  must make zero external requests.

These tests inspect the wrapper and Matomo's public command boundary. They do not
download a tracking script or submit data to a live analytics server. Backend
availability and receipt of analytics are not part of this validation.

Reference: [Matomo tracking consent](https://developer.matomo.org/guides/tracking-consent)
and [JavaScript API](https://developer.matomo.org/api-reference/tracking-javascript).
