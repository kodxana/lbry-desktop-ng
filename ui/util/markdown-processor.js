import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkFrontmatter from 'remark-frontmatter';
import stripMarkdown from 'strip-markdown';
import { formattedLinks, inlineLinks } from 'util/remark-lbry';
import remarkTimestamp from 'util/remark-timestamp';
import remarkEmote from 'util/remark-emote';
import remarkLinkAttributes from 'util/remark-link-attributes';

export default function markdownProcessor({ strip = false, disableTimestamps = false } = {}) {
  const processor = remark()
    // Keep the existing Markdown dialect. Footnote navigation is not supported
    // by the app's link component; don't silently introduce incomplete footnotes.
    .data('micromarkExtensions', [
      {
        disable: { null: ['gfmFootnoteDefinition', 'gfmFootnoteCall', 'gfmPotentialFootnoteCall'] },
      },
    ])
    .use(remarkGfm, { singleTilde: false })
    .use(remarkFrontmatter, ['yaml']);

  if (strip) return processor.use(stripMarkdown);

  return processor
    .use(remarkLinkAttributes)
    .use(inlineLinks)
    .use(formattedLinks)
    .use(disableTimestamps ? null : remarkTimestamp)
    .use(remarkEmote)
    .use(remarkBreaks);
}
