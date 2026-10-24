# DOCX renderer dependency

The desktop pins Mammoth 1.13.0, upgraded from 1.4.21. Word previews still read
authorized document bytes through the preload bridge, convert them in the browser
build, and sanitize the resulting HTML before displaying it.

## Compatibility changes

The [upstream changelog](https://github.com/mwilliamson/mammoth.js/blob/1.13.0/NEWS)
describes the changes between these versions:

- Conversion now returns native promises. Our viewer uses standard `then` and
  `catch`, with no Bluebird-specific methods. Failed conversions continue to show
  the existing error screen.
- XML parsing uses xmldom instead of sax, and decoding uses TextDecoder. The
  pinned Electron runtime provides TextDecoder. The production browser build is
  tested with Node globals absent, including embedded image conversion.
- External file access is disabled by default. The viewer also sets
  `externalFileAccess: false` explicitly. Linked images remain unavailable in
  the browser converter; embedded raster images still display. HTML sanitizing
  continues to remove unsafe links and image sources.
- Strict DOCX namespaces, moved revisions and custom XML text are supported.
  Documents display the current revision rather than deleted or moved-from text.

The lockfile drops Mammoth's old Bluebird and sax versions, reuses the existing
xmldom package and updates its style-map parser. Other dependencies can still
use Bluebird or sax; this is not a project-wide removal of those libraries.

## Validation

`node build/testRenderer.js` uses synthetic DOCX fixtures for both transitional
and strict namespaces. It checks headings, bold text, XML entities, Unicode,
tables, lists, bookmarks, footnotes, tracked revisions, embedded PNG decoding,
blocked linked images, unsafe hyperlinks, corrupt ZIPs and missing document
bodies. The separate sandbox suite checks conversion and sanitizing through the
production preload with no Node globals. Existing Markdown, text, PDF and media
tests continue to run.

Windows/Linux CI also requires wallet ZIP compatibility, real SDK encrypted
backup restore, native saved-password migration and restart, package verification
and application startup/shutdown. Hosted Windows CI exercises actual installed
upgrades and preserves wallet keys, passwords and application storage. All wallet
profiles are disposable and unfunded.

Conversion still runs in the renderer without a worker timeout. These fixtures
do not establish responsiveness for arbitrarily large or complex documents, or
pixel-for-pixel Word layout fidelity. macOS is not part of the current CI matrix.
