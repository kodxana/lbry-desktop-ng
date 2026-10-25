# Markdown editor dependencies

This batch updates the shared editor used by posts, publish descriptions, channels
and collections:

| Dependency | Previous resolved version | Current version |
| --- | --- | --- |
| react-simplemde-editor | 4.1.5 | 5.2.0 |
| EasyMDE | 2.16.1 | 2.21.0 |
| CodeMirror | 5.65.6 | 5.65.21 |
| Typo.js | 1.2.1 | 1.4.0 |

EasyMDE is now an explicit peer dependency of the React wrapper. CodeMirror stays
on the latest 5.x release because EasyMDE requires its API; CodeMirror 6 is a
separate editor migration. The lockfile shares one CodeMirror and one Typo.js
version across the editor and its spelling plugin.

## Compatibility changes

The wrapper was rewritten with hooks. Changing its options object recreates the
editor, which loses focus, selection and undo history on controlled form updates.
The shared field now owns stable options, event handlers and an instance callback.
The wrapper handles event subscription and editor cleanup. Changes to disabled
state and placeholder update the existing CodeMirror instance directly.

Length checks read the current field props, including after a limit changes.
Selection replacement counts removed characters. Restoring a saved draft or
loading an existing post preserves its complete text even when it exceeds the
current editing limit. Disabled editors reject typing and toolbar modifications
while still accepting loaded content.

The existing link action continues to select the URL placeholder after Ctrl-K or
a toolbar click, including multiline labels. Its delayed selection is cancelled
on a later edit, mode switch or unmount. Preview still uses the app's Markdown
renderer: formatting is preserved, scripts are removed and LBRY links remain
inert within the editor preview.

## Offline assets

Font Awesome 4.7.0 provides the existing toolbar glyphs as a local dependency.
The existing codemirror-spell-checker 1.1.2 plugin is also explicit, with its
English dictionary bundled as bytes and decoded using the dictionary's Latin-1
encoding. Its shared spelling engine is initialized on first editor use. These
assets replace the editor's public CDN requests, without adding a new font or
changing the dictionary language. Their package notices ship in static/licenses.

## Validation

`node build/testRenderer.js` mounts the production shared field in Electron and
checks native text input and keyboard shortcuts, controlled updates, focus and
undo retention, toolbar formatting, link selection, changing limits, longer
restored drafts, disabled/loaded states, spelling (including accented words),
local font loading, sanitized preview, native context-menu selection/paste, mode
switches and unmount cleanup. System clipboard tests run only on disposable
hosted CI runners. The network audit rejects external editor asset requests.

The same suite retains wallet backup/encryption, saved-password and update
coverage. Production packaging, isolated SDK tests, packaged/development smoke
tests and the hosted installed-upgrade workflow remain required.

References: [React wrapper v5 migration](https://github.com/RIP21/react-simplemde-editor#new-in-v5)
and [EasyMDE changelog](https://github.com/Ionaru/easy-markdown-editor/blob/master/CHANGELOG.md).
