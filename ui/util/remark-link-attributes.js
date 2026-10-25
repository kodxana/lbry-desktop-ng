import parseAttributes from 'md-attr-parser';

// Retain the legacy {...} suffix on inline links and images. The attribute
// grammar is unchanged; the renderer still sanitizes every resulting property.
export default function remarkLinkAttributes() {
  const data = this.data();
  const syntax = data.micromarkExtensions || (data.micromarkExtensions = []);
  const trees = data.fromMarkdownExtensions || (data.fromMarkdownExtensions = []);
  syntax.push({ text: { 123: { name: 'lbryAttributes', tokenize } } });
  trees.push({
    exit: {
      lbryAttributes(token) {
        const parent = this.stack[this.stack.length - 1];
        const node = parent.children[parent.children.length - 1];
        const attributes = parseAttributes(this.sliceSerialize(token));
        const properties = Object.fromEntries(
          Object.entries(attributes.prop).map(([key, value]) => [key, value || ''])
        );
        node.data = { ...node.data, hProperties: properties };
        node.position.end = { ...token.end };
      },
    },
  });

  function tokenize(effects, ok, nok) {
    const event = this.events[this.events.length - 1];
    const resource = this.events[this.events.length - 2];
    if (
      !event ||
      event[0] !== 'exit' ||
      !['link', 'image'].includes(event[1].type) ||
      !resource ||
      resource[1].type !== 'resource'
    ) {
      return nok;
    }
    let value = '';
    let quote;
    let escaped = false;
    return begin;

    function begin(code) {
      effects.enter('lbryAttributes');
      return read(code);
    }
    function read(code) {
      if (code === null || code < -2) return nok(code);
      // Micromark expands tabs into one tab code and virtual padding spaces.
      if (code === -1 || code === -2) {
        if (code === -2) value += '\t';
        effects.consume(code);
        return read;
      }
      const character = String.fromCharCode(code);
      value += character;
      if (quote) {
        if (!escaped && character === quote) quote = null;
        escaped = !escaped && character === '\\';
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === '}') {
        if (parseAttributes(value).eaten !== value) return nok(code);
        effects.consume(code);
        effects.exit('lbryAttributes');
        return ok;
      } else if (character === '{' && value.length > 1) {
        return nok(code);
      }
      effects.consume(code);
      return read;
    }
  }
}
