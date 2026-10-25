# Markdown parser migration

The desktop now uses remark 15.0.1, remark-gfm 4.0.1, remark-breaks 4.0.0,
remark-frontmatter 5.0.0 and strip-markdown 6.0.0. unist-util-visit moves to 5.1.0.
The obsolete remark-attr and remark-emoji plugins are removed. Standard emoji
use node-emoji 2.2.0, the lookup library behind the current remark-emoji release.
The renderer and sanitizer remain the versions introduced in the
[renderer migration](markdown-renderer.md).

## API and syntax compatibility

Remark's [micromark migration](https://github.com/remarkjs/remark/releases/tag/13.0.0)
removed the old `Parser.prototype.inlineTokenizers` hooks. The LBRY, timestamp
and custom-emote plugins now register micromark syntax and mdast handlers through
the processor's public extension data. They consume original source tokens, so
escaped punctuation, character references, code and link destinations cannot
accidentally become channel mentions or seek links after parsing.

`markdown-processor.js` configures both the production preview and sandbox
dependency test. Remark now has a named export, the React compiler uses
`compiler` instead of `Compiler`, and React results use `file.result` instead of
`file.contents`. No Markdown is evaluated as JavaScript and raw HTML remains
disabled by the renderer.

Tables, task checkboxes and double-tilde deletion now come from remark-gfm rather
than remark's old built-in GFM parser. Single tildes remain literal. Footnote
syntax remains disabled: the desktop link component does not implement Markdown
footnote navigation. This does not affect Word document footnotes.

Standard emoji shortcodes use the same source-token extension as custom emotes.
Applying remark-emoji to an already decoded text tree would also replace escaped
shortcodes and character references. Parsing the shortcode before decoding keeps
those literal and retains custom-emote precedence, including lowercase names.

The legacy `{...}` suffix on inline links and images retains its existing
md-attr-parser 1.3.0 grammar. It is now a direct dependency rather than being
pulled in by remark-attr. Only a suffix immediately following an inline link or
image is consumed; malformed, escaped or separated braces remain text. All
resulting HTML properties pass through the renderer's sanitizer. Existing
`embed` values retain their original semantics, including empty values and the
truthy string `"false"`; this migration does not reinterpret saved descriptions.

Timestamps remain limited to ordinary paragraphs, with the existing exclusions
for lists, quotes, headings, formatting wrappers and link labels. The existing
post/comment opt-outs remain. Custom emote images remain paragraph-only; their
text is preserved in other contexts.

## Deliberate differences

The current CommonMark/GFM parser recognizes bare `www` addresses and email
addresses. These are external links, not channel mentions. Ordinary Markdown
escaping now applies to the custom syntax as well.

The old tokenizer could discard an underscore-containing URI, truncate a
hyphenated channel name, ignore a channel claim ID or miss a valid timestamp
following another timestamp. The replacement retains the whole name and claim
ID and recognizes each valid timestamp. It leaves sentence punctuation outside
links and rejects invalid minute/second fields without accepting a shorter
suffix of the rejected timestamp.

## Validation

`build/tests/markdownParser.js` renders the production parser and compiler into
an inert document. It covers URI and mention forms, formatting wrappers,
reference links, escapes/entities, code, external URLs, timestamp boundaries and
scope, custom/standard emoji, attribute suffixes and sanitization. These tests
run alongside the actual component navigation, player seeking, legacy iframe,
formatting, document and sandbox regressions in `build/testRenderer.js`.

The full Windows/Linux checks cover native password migration and restart,
wallet ZIP backups, real SDK encryption and encrypted restore with preserved
keys/addresses, packaging and startup. Hosted Windows tests perform real NSIS
upgrades using disposable, unfunded wallets. The SDK binary, wallet formats,
Electron, React and updater versions are unchanged by this migration.
