import { sanitize, defaultSchema } from 'hast-util-sanitize';

const schema = {
  ...defaultSchema,
  // Keep document formatting supported before the version 5 schema changes.
  tagNames: [
    ...defaultSchema.tagNames,
    'abbr',
    'bdo',
    'caption',
    'cite',
    'dfn',
    'figcaption',
    'figure',
    'mark',
    'small',
    'time',
    'wbr',
  ],
  protocols: { href: ['http', 'https', 'mailto', 'lbry'], src: ['data'] },
  attributes: {
    '*': ['id', 'title'],
    a: ['href'],
    img: ['src', 'alt'],
    td: ['colSpan', 'rowSpan'],
    th: ['colSpan', 'rowSpan'],
    ol: ['start'],
  },
};
const names = { colspan: 'colSpan', rowspan: 'rowSpan' };

// Parse in an inert template, then apply the document's HAST schema.
// Rebuild from the sanitized tree instead of removing unsafe substrings from HTML.
export default function sanitizeDocumentHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  function toHast(node) {
    if (node.nodeType === Node.TEXT_NODE) return { type: 'text', value: node.textContent };
    if (node.nodeType !== Node.ELEMENT_NODE) return { type: 'text', value: '' };
    const properties = {};
    for (const attribute of Array.from(node.attributes)) {
      const name = names[attribute.name] || attribute.name;
      if (name === 'href') {
        if (attribute.value.startsWith('#')) {
          properties.href = '#user-content-' + attribute.value.slice(1);
        } else if (/^lbry:\/\//i.test(attribute.value)) {
          // LBRY channel names and claim IDs are not URL credentials or ports.
          properties.href = 'lbry://' + attribute.value.slice(7);
        } else {
          try {
            const url = new URL(attribute.value);
            if (schema.protocols.href.includes(url.protocol.slice(0, -1))) properties.href = url.href;
          } catch (_) {
            /* Relative paths must not become local file links. */
          }
        }
        continue;
      }
      // DOCX embeds raster images. Do not let a document read local files or fetch remote images.
      if (name === 'src' && !/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(attribute.value)) continue;
      properties[name] = attribute.value;
    }
    return { type: 'element', tagName: node.localName, properties, children: Array.from(node.childNodes, toHast) };
  }
  const tree = sanitize({ type: 'root', children: Array.from(template.content.childNodes, toHast) }, schema);
  function toDom(node) {
    if (node.type === 'text') return document.createTextNode(node.value);
    const element = document.createElement(node.tagName);
    for (const [name, value] of Object.entries(node.properties || {})) element.setAttribute(name, String(value));
    for (const child of node.children || []) element.appendChild(toDom(child));
    return element;
  }
  const clean = document.createElement('template');
  for (const child of tree.children) clean.content.appendChild(toDom(child));
  return clean.innerHTML;
}
