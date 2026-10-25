import { parseURI } from 'util/lbryURI';
import { visit } from 'unist-util-visit';
import inlineToken from 'util/remark-inline-token';

const protocol = 'lbry://';
export const punctuationMarks = [',', '.', '!', '?', ':', ';', '-', ']', ')', '}'];

function link(value) {
  try {
    const uri = parseURI(value);
    const channel = uri.isChannel;
    return {
      type: 'link',
      url: (value.startsWith(protocol) ? '' : protocol) + value,
      data: { hProperties: { embed: !channel } },
      children: [{ type: 'text', value: channel ? uri.claimName : value }],
    };
  } catch (error) {
    return null;
  }
}

export function inlineLinks() {
  for (const [name, start] of [
    ['lbryUri', 'l'],
    ['lbryMention', '@'],
  ]) {
    inlineToken(this, {
      name,
      start,
      previous: (character, delimiter) => delimiter || !/[-_.+=?!@#$%^&*:;,{}<>\w/\\]/.test(character),
      accepts: (character) => !/[\s"'<>()[\]{}*`~\\]/.test(character),
      match: (value, delimiter) => {
        if (!(start === 'l' ? value.startsWith(protocol) : value.startsWith('@'))) return null;
        const text = (delimiter === '_' ? value.replace(/_+$/, '') : value).replace(/[,!.?:;\-\])}]+$/, '');
        return link(text) ? text : null;
      },
      node: (value, parents) =>
        parents.some((parent) => ['link', 'linkReference', 'image'].includes(parent.type)) ? null : link(value),
    });
  }
}

export function formattedLinks() {
  return (tree) => {
    visit(tree, 'link', (node, index, parent) => {
      if (parent.type !== 'paragraph' || !node.url.startsWith(protocol)) return;
      const parsed = link(node.url);
      if (parsed && parsed.data.hProperties.embed) {
        node.data = { ...node.data, hProperties: { embed: true, ...(node.data && node.data.hProperties) } };
      }
    });
  };
}
