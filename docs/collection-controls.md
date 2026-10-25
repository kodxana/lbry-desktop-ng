# Collection controls

Collection reordering uses `@hello-pangea/dnd` 18.0.1 in the collection page,
publishing editor and playback sidebar. It replaces `react-beautiful-dnd` while
retaining the same drag callbacks, collection actions and stored order.

The initial replacement used 16.6.0 to retain React 17 compatibility. The
[React 18 upgrade](react-and-material.md) moves it to 18.0.1. The replacement's
17.x release dropped React 16/17, and 18.x supports React 18/19. Collection
actions and persisted order stay unchanged during this upgrade.

The multiple-file chooser uses native radio inputs with a unique group name per
list. Labels, arrow-key selection and the existing radio styles remain. Replacing
the files clears an invalid selection or selects the remaining first file. The
accepted file still passes the desktop's native-path validation before updating
the publish form. The later [comic reader migration](comic-reader.md) removes
the remaining Reakit dependency and its compatibility adapter.

## Validation

The Electron collection fixtures use the production collection page, editor,
sidebar, claim rows and Redux actions. They cover keyboard and mouse reordering,
Escape cancellation, focus restoration, move/remove controls, unmount cleanup,
and prevention of unintended navigation or publishing. Native dropped-file tests
cover duplicate filenames, label and keyboard selection, independent groups,
empty or shortened file lists, cancellation and invalid paths.

The Flow source gate checks collection form parameters, nullable add/select
records, preview loading, native keyboard events and their callers. Renderer
fixtures cover Enter submission with a resolved claim, blank-name rejection,
unmount cleanup, pending selections, missing built-in lists and scoped Escape
search clearing. They also exercise multi-tag input, metadata and location
preservation, publish failure/success/cancellation, ownership-sensitive claim
menus, one-shot shuffle playback and public/private deletion confirmation.
The preview connector has a separate regression requiring the loading thunk
to reach dispatch. Publishing tests inspect SDK request payloads without
submitting real transactions.

Keep the Windows/Linux renderer, native password-storage, wallet backup and
encryption, packaging, and hosted Windows installed-upgrade checks required.
Fixtures use disposable profiles and unfunded wallets. Physical touch and manual
screen-reader acceptance remain separate checks.

References: [replacement changelog](https://github.com/hello-pangea/dnd/blob/main/CHANGELOG.md),
[18.0.1 release](https://github.com/hello-pangea/dnd/releases/tag/v18.0.1).
