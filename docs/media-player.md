# Video.js 8 migration

The player moves from Video.js 7.19.2 to 8.24.1, with quality-levels 4.1.0
and HTTP Streaming (VHS) 3.17.5. The later [media dependency batch](legacy-media-adapters.md)
replaces event-tracking 1.0.3 with local first-play, buffering and seeking handlers.
The lockfile shares one Video.js instance between
the player and plugins instead of retaining two copies of version 7. A Yarn
resolution keeps their broad dependency ranges on 8.24.1; the renderer runner
rejects installations that resolve a different player instance for a plugin.

Version 8 is an intermediate compatibility step. The
[upstream support plan](https://videojs.org/docs/framework/react/guides/v10-roadmap)
still provides fixes for it. Video.js 10 uses a new component architecture and
requires a separate migration of our controls, overlays and event integration.

## Compatibility changes

The [7-to-8 migration guide](https://legacy.videojs.org/guides/videojs-7-to-8/)
requires native classes for custom components. The old Babel configuration
compiled our subclasses into functions, causing `MenuButton cannot be invoked without 'new'` during player startup. A scoped Babel override preserves classes
only in the player's internal components and plugins. Production and development
builds use that same override.

The bundled quality-selector, overlay, mobile-UI and recommendation plugins use
`videojs.obj.merge` instead of deprecated `videojs.mergeOptions`. Existing ARIA
attributes already use `setAttribute`; the tracking plugin listens for `playing`
and does not depend on the removed `firstplay` event. Its separate
`tracking:firstplay` event is retained.

Source changes dispose the old player, remove its wrapper and unregister the
exact keyboard listener that was installed. A delayed content-type check cannot
create a player after its component has unmounted.

## Validation

`node build/testRenderer.js` mounts the production player and custom controls
against generated local media. The checks cover:

- H.264/AAC MP4, HTTP range requests, audio, redirected HLS and MediaSource
  decoding, pause, playback speed, seeking, completion and disposal.
- A two-rendition HLS master playlist, manual/Auto menu choices, selection ARIA
  state and the corresponding enabled VHS representations. This checks the
  selection policy, not immediate replacement of already-buffered frames.
- Custom volume, next/previous, theater and autoplay controls; keyboard speed
  changes and overlays; initial-play and seeking tracking events.
- Source replacement, single keyboard dispatch after replacement, cleanup and
  unmounting while content-type responses are pending.

The existing Windows/Linux wallet backup, encryption, saved-password, updater,
package and startup gates remain required. Fixtures use disposable profiles and
local synthetic media; no public content or personal wallet is needed.

Hardware decoding, live streams, complex adaptive streams, subtitles, native
fullscreen interaction and macOS still need separate acceptance testing.
