import inlineToken from 'util/remark-inline-token';

const timestamp = /^(?:[0-9]|[0-5][0-9]):[0-5][0-9]$|^[0-9]{1,2}:[0-5][0-9]:[0-5][0-9]$/;

export default function remarkTimestamp() {
  inlineToken(this, {
    name: 'lbryTimestamp',
    start: '0123456789',
    previous: (character) => !/[\w:]/.test(character),
    accepts: (character) => /[0-9:]/.test(character),
    match: (value) => {
      const text = value.replace(/:+$/, '');
      return timestamp.test(text) ? text : null;
    },
    node: (value, parents) => {
      // Preserve the existing paragraph-only scope, including the opt-out in
      // lists and quotes. Code and link destinations are never tokenized.
      if (
        parents[parents.length - 1].type !== 'paragraph' ||
        parents.some((parent) => ['listItem', 'blockquote'].includes(parent.type))
      ) {
        return null;
      }
      const seconds = value.split(':').reduce((total, part) => total * 60 + Number(part), 0);
      return { type: 'link', url: `?t=${seconds}`, title: value, children: [{ type: 'text', value }] };
    },
  });
}
