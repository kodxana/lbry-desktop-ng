import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { toHast } from 'mdast-util-to-hast';
import { sanitize, defaultSchema } from 'hast-util-sanitize';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';

const schema = {
  ...defaultSchema,
  protocols: { ...defaultSchema.protocols, href: [...defaultSchema.protocols.href, 'lbry'] },
  attributes: { ...defaultSchema.attributes, a: [...defaultSchema.attributes.a, 'embed'] },
};

// Sanitization always runs after syntax plugins and before React components.
export default function markdownRenderer({ components } = {}) {
  this.compiler = (tree) => toJsxRuntime(sanitize(toHast(tree), schema), { Fragment, jsx, jsxs, components });
}
