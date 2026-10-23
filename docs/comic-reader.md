# Comic reader dependencies

The desktop now uses OpenSeadragon 6.1.1 and libarchive.js 2.0.2 directly.
Villain 1.0.9, Reakit and their obsolete React slider, animation and localization
dependencies are removed. This removes the remaining Reakit restriction on a
React upgrade. The subsequent [React/state batch](react-and-material.md) moves
the renderer to React 18, followed by React 19.3.1.

The reader retains previous/next, a page field and slider, zoom controls,
single-page/book layout, manga direction, fullscreen, dark/light backgrounds
and toolbar pinning. Book mode leaves the cover alone and shows the current and
following page together afterward. Navigation still advances one page at a time.
Controls use the desktop's buttons, Ariakit menu and translations, including the
app's language setting instead of a separate reader language menu. The app theme
sets the initial reader theme; a reader-only dark/light toggle remains available.
Unpinning hides controls until pointer hover or keyboard focus, without motion.

OpenSeadragon now defaults to WebGL. We explicitly retain its canvas drawer,
so reading does not require a graphics capability that the old reader lacked.
The integration uses public viewport/world APIs rather than the changed tile
cache internals. Pages remain local blob URLs; archives are never extracted to
disk or sent to an external service.

The decoder's worker is now a module worker, with its WASM file beside it.
Both are copied from the pinned package for production and development builds.
Package verification compares their bytes against the dependency. The checked-in
1.3.0 worker and WASM files are removed.

The Yarn patch rejects archive path components inherited from Object.prototype
and traversal through file objects before libarchive builds its directory tree. It changes the browser distribution
and its corresponding source. Files are selected by image extension, excluding
macOS resource forks, and sorted by full path with numeric page ordering.
Empty, encrypted and malformed archives show an error. The old 500-page limit
is explicit instead of silently truncating a book. Compressed input and total
page bytes are capped at 512 MiB, with a 32 MiB cap per page before extraction.
These bounds may reject unusually large comics; the downloaded original remains
available to open in another reader.

Every archive operation has a 30-second timeout. Closing or replacing the reader
terminates its worker, ignores late file reads, disposes the zoom viewer and
revokes its page URLs. An unreadable image leaves navigation available so the
reader can advance to another page.

## Validation

The Electron comic fixture checks independent ZIP/TAR/7z page pixels, RAR 4/5
contents against upstream hashes, numeric ordering, book and manga layouts,
page fields, slider/keyboard navigation, zoom, themes, native fullscreen and its
denial path, archive limits/failures, cancellation and worker/URL cleanup. The sandbox fixture opens
an authorized CBZ without renderer Node access. Packaging checks require the
matching worker/WASM pair. Existing wallet backup/encryption, saved-password
migration/restart/forget and updater consent/shutdown tests remain required,
alongside Windows/Linux packaging and hosted Windows installed upgrades.

macOS, physical touch gestures and performance with a large comic library are
outside these checks. Encrypted comics remain unsupported.

References: [Villain features](https://github.com/btzr-io/Villain),
[libarchive.js API](https://github.com/nika-begiashvili/libarchivejs),
[OpenSeadragon 5 migration](https://openseadragon.github.io/examples/migration-v5/),
[OpenSeadragon 6 migration](https://openseadragon.github.io/examples/migration-v6/).
