# Legacy media dependencies

This batch replaces three packages with no newer stable npm release:
country-data 0.0.31, ffmpeg-probe 1.0.6 and videojs-event-tracking 1.0.3.
It leaves the Electron, Video.js and SDK versions unchanged.

## Country values

country-data-list 1.6.3 supplies the country names shared by the report and
purchase forms. The [maintained fork](https://github.com/Sonatrix/country-list)
has no runtime dependencies. Its published countries-only exports are broken
(the CommonJS target is absent and the ESM export contains no country records),
so the application uses the tested root export.

Accounts store country names, not ISO codes. A saved name missing from the new
list remains an option and is not rewritten on page load. New selections use
the current dataset. Turkiye and Vietnam map to the existing Turkey and
Viet Nam entries for purchase eligibility; this does not add countries to
the provider allowlist. Unknown saved values retain the existing unsupported
country path. There is no purchase-provider availability change in this batch.

## Media metadata

The main process calls FFprobe with Node's `execFile` instead of the old wrapper
and its execa 0.10 dependency. It passes the authorized filename as a literal
argument, honors `FFPROBE_PATH`, hides the Windows console, and limits execution
to 15 seconds and output to 1 MiB. Only the container format and duration are
needed by the app. Duration is returned as finite, nonnegative seconds; absent
duration is zero. Invalid JSON, process failures and unavailable FFprobe retain
the file detail handler's optional-probe fallback. The existing file grants and
renderer checks still authorize access before the process runs.

FFprobe remains an optional external executable; this change does not bundle it.
Unused stream metadata and the wrapper's derived dimensions/frame rate are
removed.

## Playback events

The local Video.js plugin retains `tracking:firstplay`, `tracking:buffered` and
`tracking:seek` with the payload names used by the app. Load and buffer durations
use a monotonic clock and seconds rounded to three decimal places. First play is
reported once per source/replay; ordinary pause/resume does not report it again.
A stall ends when the rounded play position advances. Seeking retains its count
and rounded target, and the 200 ms scrub grace period prevents scrubbing from
being counted as buffering.

Source changes and completion reset counts. Disposal unregisters every listener;
there are no global unload listeners or pending timers. Attaching after loading
reports zero when the load start was not observed. Unused pause, quartile,
performance and unload tracking from the old dependency is removed. The plugin
does not send analytics itself; existing consent and analytics callers remain.

## Validation

- `node build/testMediaAdapters.js`: saved/renamed country options, deterministic
  load/buffer/seek timing, repeat events, source/replay resets, disposal, literal
  process arguments, output validation and process failure propagation.
- `node build/testMediaAdapters.js --native`: real FFprobe on a six-second MP4,
  Unicode and shell-metacharacter filenames, non-media and missing files.
  This requires FFprobe on PATH (or `FFPROBE_PATH`) and is a local optional check.
- `node build/testRenderer.js`: real purchase selects preserve saved values and
  existing eligibility; MP4/audio/HLS playback still emits first-play/seek events.
  The same suite covers documents, wallet forms, saved state and updater IPC.
- Full Flow, lint and the desktop regressions cover dependency contracts, wallet
  backups, password migration and updater install/decline/shutdown behavior.
  Windows/Linux CI also exercises OS password storage, isolated SDK encryption
  and backup restoration, packaging and development startup. The separate
  installed-upgrade workflow checks the actual Windows installer chain.

Tests use disposable profiles, synthetic wallets and local media. This does not
validate funded transactions, purchase-provider service availability or macOS.
