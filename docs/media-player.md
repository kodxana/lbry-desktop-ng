# Video.js 10 migration

The desktop uses @videojs/react, @videojs/hlsjs-video and @videojs/dash-video
10.2.0. This follows the [Video.js migration guide](https://videojs.org/docs/framework/react/guides/migrate-from-video-js-8):
version 10 replaces the old player/component/plugin API with React components,
media adapters and native media events. The unscoped video.js package no longer
contains a player.

## Compatibility

MP4 and audio use native media elements. HLS uses hls.js through the official
adapter because existing SDK streams can contain MPEG-TS segments; the SPF-only
adapter does not cover that format. DASH retains its own official adapter.
Source detection follows SDK redirects and recognizes manifest paths with query
strings as well as response MIME types. Pending detection is aborted on unmount.

The desktop retains its dark player controls, playback speeds (including 1.1x),
playlist navigation, autoplay-next setting, theater/fullscreen controls, volume,
saved position and timestamp links. Quality selection uses Video.js rendition
state, with manual choices and Auto. Quality switches take effect at fragment
boundaries rather than instantly replacing the current frame. Caption choices
use native text tracks. Keyboard shortcuts defer to focused form controls and
sliders; the timeline and volume controls have their own keyboard semantics.

The old quality-selector, mobile-UI, overlay, volume and recommendation plugins
are removed, along with Video.js 8, quality-levels, VHS and the Babel subclass
override. First-play, buffer and seek payloads retain their existing formats.
Recommendation events read current telemetry consent, including during cleanup.
Player cleanup saves position before adaptive adapters detach, removes listeners
and stops playback. Updating a control does not recreate the decoder.

## Validation

The renderer test command (node build/testRenderer.js) exercises the production components in Electron
against generated loopback fixtures. It covers:

- MP4 range requests, redirected HLS, two HLS renditions, DASH and audio decoding;
  play/pause, seek, speed, completion, replacement and cleanup.
- Manual HLS choices changing decoded frame dimensions, returning to Auto,
  and accessible control labels.
- Real keyboard input for seek/volume sliders and rate selection, fullscreen
  enter/exit, theater and autoplay switches, muted-playback recovery, VTT
  captions, compact/embed layout, and dark/light screenshots.
- Saved position, volume, mute and speed callbacks; Previous restarting the
  current item after five seconds and otherwise navigating to the previous one.
- Source detection failure, rejected autoplay, actual failed media loading and
  retry, plus late detection after unmount.

Unit checks cover timing, consent withdrawal and listener cleanup. Flow checks
include positive and negative contracts for the new player APIs. Package checks
reject the removed dependencies. The existing wallet backup/encryption,
saved-password migration/native storage, updater, SDK and installed-upgrade
gates remain required on the candidate revision.

Fixtures contain no personal wallet or third-party media. Hardware decoding,
live/adaptive behavior on slow public streams, DRM and macOS still need separate
acceptance testing. This migration does not change the SDK or Electron version.
