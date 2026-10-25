# CodeMirror 6 editor

Posts, publish descriptions, channels and collections now use CodeMirror 6
without EasyMDE or react-simplemde-editor. The read-only document/code viewer
also uses version 6, so CodeMirror 5 and its spelling plugin leave the lockfile.

The direct modules are pinned: state 6.7.6, view 6.43.15, commands 6.11.1,
language 6.13.1, lang-markdown 6.5.2, language-data 6.5.2 and Lezer highlight 1.2.5.
The state constructors resolve to one copy across all editor packages.

## Editing compatibility

The shared field creates one EditorView per mount. Controlled text changes and
compartment reconfiguration preserve focus, selection and undo history while
limits, disabled state, labels and placeholders change. External draft loads
bypass editing limits and do not emit a user change or enter undo history.
An over-limit restored draft is preserved; users can shorten it without losing
unrelated text. Typed/pasted replacements account for removed characters, and
limits do not split UTF-16 surrogate pairs. Formatting that cannot fit is rejected
as a whole. Disabled and preview-only views reject document edits.

The toolbar retains bold, italic, quote, lists, links, preview and the Markdown
guide, using the existing local Font Awesome assets and application theme colors.
Formatting and link URL selection happen in one transaction. There is no delayed
selection callback. Existing heading, image, task-list, code-block, clean-block,
preview, F9 side-by-side and F11/Escape fullscreen shortcuts remain available.
Enter continues lists; Tab/Shift-Tab indent lists while Tab outside lists remains
available for keyboard navigation. Line, word, cursor and character counts remain.

Preview uses the application's sanitized Markdown renderer and keeps LBRY links
inert, as before. The editor does not introduce a second Markdown rendering engine.
The existing English dictionary and license are preserved byte-for-byte under
`ui/util/dictionaries`. A viewport-scoped CodeMirror view plugin uses Typo.js 1.4.0
and native word segmentation; it excludes code, URLs and HTML markup. No editor
asset requires a CDN, and dictionary bytes retain their ISO-8859-1 encoding.

## Document viewer

The read-only viewer retains selection, native Copy/Select All, line numbers,
wrapping and dark/light colors. Language support loads from locally bundled
CodeMirror 6 chunks. Existing MIME mappings cover JavaScript/JSX, CSS, HTML/XML,
PHP, Go, Ruby, C/C++/Java/C#, shell, Python and Markdown; unknown types remain
readable plain text. A later content-type change or unmount invalidates an older
language request, and a failed syntax chunk leaves the text visible.

## Validation

`node build/testRenderer.js` exercises the production components in Electron:
controlled input, selection, undo/redo, nested formatting, toolbar and keyboard
commands, list continuation/indentation, URL selection, IME composition, live
limits, emoji boundaries, restored drafts, disabled/loaded state, offline spelling,
sanitized preview, theme styles, mode changes and unmount cleanup. Native context
menus exercise editor and read-only viewer selection. Actual clipboard contents
are changed only on disposable hosted CI runners.

The renderer suite also retains wallet backup/encryption, saved-password migration
and updater coverage. Full Flow and source-contract checks validate the version 6
API declarations. Packaging verifies the removed editor packages are absent and
the dictionary notice is included. The Windows/Linux desktop workflows and actual
installed Windows upgrade workflow remain required before review is complete.
Tests use disposable profiles and unfunded wallets; macOS and funded transactions
are not part of this migration.

References: [CodeMirror migration guide](https://codemirror.net/docs/migration/),
[transactions](https://codemirror.net/docs/ref/#state.Transaction),
[configuration compartments](https://codemirror.net/examples/config/) and
[the previous editor shortcuts](https://github.com/Ionaru/easy-markdown-editor/blob/2.21.0/src/js/easymde.js).
