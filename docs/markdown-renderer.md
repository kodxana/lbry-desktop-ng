# Markdown renderer migration

Markdown no longer uses remark-react 8 or hast-util-sanitize 3. It converts the
parser's tree with mdast-util-to-hast 13.2.1, sanitizes it with hast-util-sanitize
5.0.2, then renders React elements with hast-util-to-jsx-runtime 2.3.6. Both normal
content and stripped previews use this path.

## Compatibility

`ui/util/markdown-renderer.js` adapts remark 9's `Compiler` interface to the
maintained tree utilities. The parser, attribute plugin and custom LBRY,
timestamp and emote tokenizers remain on their existing versions. Updating those
is a separate migration; this change removes the obsolete rendering and
sanitization dependencies without rewriting Markdown recognition at the same time.

The [JSX tree renderer](https://github.com/syntax-tree/hast-util-to-jsx-runtime)
accepts the automatic React runtime, which is already available in the pinned
React 16.14 release. See React's [runtime compatibility notes](https://legacy.reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html).
The installed React/Babel versions and other JSX compilation remain unchanged.
The manifest now requires React/React DOM 16.14 or later within the 16.x line,
matching the already locked runtime and its JSX entry points.

The renderer passes a single child directly instead of wrapping every child in
an array. `MarkdownLink` now accepts either representation when identifying a
labelled website link. A labelled Odysee link must stay external instead of
starting claim resolution.

Sanitization runs after tree conversion and plugin properties, before React
components. The schema extends the public defaults for LBRY links and the
existing `embed` property. It does not enable raw HTML or MDX evaluation.
The new defaults retain language classes on fenced code; table alignment is
converted to React styles by the renderer. The old root-fragment workaround
and table-style dependency are no longer needed.

## Validation

`build/tests/markdown.jsx` uses the production Markdown component. It covers:

- Headings, emphasis, deletion, code, quotes, lists, task checkboxes, table
  alignment, line breaks, frontmatter removal and stripped previews.
- Legacy iframe embeds, Unicode, both claim-ID separators, named/numeric
  entities, multiple embeds and surrounding text.
- Actual LBRY navigation and player timestamp clicks, labelled website links,
  image attributes, custom emotes and standard emoji. Images are serialized into
  an inert template to keep the tests offline.
- Rejection of unsafe source URLs, raw frames/scripts and unsafe properties
  added by plugins before sanitization.

The separate sandbox test uses the same compiler without renderer Node access.
The full Windows/Linux matrix also checks wallet backups, SDK encryption and
restore, native saved-password storage, updater choices, packaging and startup.
Hosted Windows CI tests actual installed upgrades with disposable, unfunded
wallets. macOS is outside this matrix.
