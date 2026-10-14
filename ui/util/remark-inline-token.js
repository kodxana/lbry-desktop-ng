// Register a small inline syntax extension through remark's public micromark
// and mdast hooks. Lookahead leaves punctuation outside the accepted token.
export default function inlineToken(processor, { name, start, accepts, match, previous, node }) {
  const data = processor.data();
  const syntax = data.micromarkExtensions || (data.micromarkExtensions = []);
  const trees = data.fromMarkdownExtensions || (data.fromMarkdownExtensions = []);
  const construct = { name, tokenize };
  syntax.push({ text: Object.fromEntries(start.split('').map((character) => [character.charCodeAt(0), construct])) });
  trees.push({
    enter: {
      [name](token) {
        const value = this.sliceSerialize(token);
        this.enter(node(value, this.stack) || { type: 'text', value }, token);
      },
    },
    exit: {
      [name](token) {
        this.exit(token);
      },
    },
  });

  function tokenize(effects, ok, nok) {
    const before = this.previous > 0 ? String.fromCharCode(this.previous) : '';
    const event = this.events[this.events.length - 1];
    const delimiter =
      event && event[0] === 'exit' && ['attentionSequence', 'strikethroughSequenceTemporary'].includes(event[1].type);
    if (previous && !previous(before, delimiter)) return nok;
    let length;
    return effects.check({ tokenize: lookAhead }, begin, nok);

    function lookAhead(probe, yes, no) {
      let value = '';
      return first;
      function first(code) {
        probe.enter(name);
        return read(code);
      }
      function read(code) {
        if (code > 0 && accepts(String.fromCharCode(code), value)) {
          value += String.fromCharCode(code);
          probe.consume(code);
          return read;
        }
        length = (match(value, delimiter ? before : '') || '').length;
        probe.exit(name);
        return length ? yes(code) : no(code);
      }
    }
    function begin(code) {
      effects.enter(name);
      return consume(code);
    }
    function consume(code) {
      if (!length) {
        effects.exit(name);
        return ok(code);
      }
      effects.consume(code);
      length -= 1;
      return consume;
    }
  }
}
