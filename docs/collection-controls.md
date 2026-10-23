# Collection controls

Collection reordering uses `@hello-pangea/dnd` 16.6.0 in the collection page,
publishing editor and playback sidebar. It replaces `react-beautiful-dnd` while
retaining the same drag callbacks, collection actions and stored order.

16.6.0 is an intermediate version: it supports the installed React 17 and React 18. The replacement's 17.x release dropped React 16/17, and 18.x adds React 19
support. Move to the current major alongside the React upgrade, after the comic
reader and remaining React constraints have been handled. The application Redux
store is unchanged; the drag library's internal React Redux dependency is separate.

The multiple-file chooser uses native radio inputs with a unique group name per
list. Labels, arrow-key selection and the existing radio styles remain. Replacing
the files clears an invalid selection or selects the remaining first file. The
accepted file still passes the desktop's native-path validation before updating
the publish form. Reakit remains a dependency of the comic reader compatibility
adapter; it is no longer used by the file chooser.

## Validation

The Electron collection fixtures use the production collection page, editor,
sidebar, claim rows and Redux actions. They cover keyboard and mouse reordering,
Escape cancellation, focus restoration, move/remove controls, unmount cleanup,
and prevention of unintended navigation or publishing. Native dropped-file tests
cover duplicate filenames, label and keyboard selection, independent groups,
empty or shortened file lists, cancellation and invalid paths.

Keep the Windows/Linux renderer, native password-storage, wallet backup and
encryption, packaging, and hosted Windows installed-upgrade checks required.
Fixtures use disposable profiles and unfunded wallets. Physical touch and manual
screen-reader acceptance remain separate checks.

References: [replacement changelog](https://github.com/hello-pangea/dnd/blob/main/CHANGELOG.md),
[React 17-compatible package](https://github.com/hello-pangea/dnd/blob/v16.6.0/package.json).
