# Document sanitizer migration

DOCX previews use hast-util-sanitize 5.0.2, upgraded from 3.0.2. Mammoth's
converted HTML still passes through `ui/util/document-html.js` before it reaches
the document viewer.

## Compatibility

The [upstream releases](https://github.com/syntax-tree/hast-util-sanitize/releases)
switch the package to ESM and replace its default export and private schema JSON
with public `sanitize` and `defaultSchema` exports. Webpack bundles those imports
for the Electron renderer.

Version 5 also changes the default schema. The document schema explicitly keeps
the formatting tags supported previously, including figure captions, marked text
and abbreviations. Its restricted attribute and URL rules remain in place:

- Links allow HTTP, HTTPS, mailto and LBRY addresses. Relative paths and local-file
  links are removed; bookmark and footnote fragments point to prefixed IDs.
- Images allow embedded PNG, JPEG, GIF and WebP data. Local files, remote images,
  SVG data and `srcset` do not pass through.
- Scripts, event handlers, inline styles and active frames are removed. IDs are
  prefixed to avoid collisions with application elements.

The migration fixtures also exposed an existing LBRY-link bug: passing a channel
address through the standard `URL` serializer could discard `@` or reject a
claim ID as an invalid port. LBRY links now preserve the address after normalizing
the scheme. HTTP, HTTPS and mailto links still use the standard URL parser.

## Markdown remains a separate migration

`remark-react` 8 still uses hast-util-sanitize 3 internally. Its schema is loaded
from the explicitly pinned `hast-util-sanitize-legacy` alias so that upgrading
DOCX cannot silently change the schema passed to the old Markdown sanitizer.
This alias is temporary: remove it when replacing that Markdown rendering path.
There is no global dependency override or disabled sanitization.

The Markdown schema clones the arrays it extends for LBRY links, rather than
modifying the imported defaults. Regression fixtures cover formatting, tables,
newlines, timestamps, stripped previews, links and legacy embeds. The remark
parser and its custom LBRY/emote/timestamp plugins are still on their old versions.

## Validation

`build/tests/documentHtml.js` checks the real document sanitizer in Electron.
`build/tests/documents.jsx` also converts generated DOCX archives and checks that
embedded images decode and both directions of footnote links resolve. These
fixtures run alongside Markdown, PDF and sandbox tests in the renderer suite.

Windows and Linux CI also require wallet backup/restore, native saved-password
storage, updater consent, package validation and startup/shutdown checks. The
separate hosted Windows job tests actual installed upgrades with disposable,
unfunded wallets. This matrix does not cover macOS.
