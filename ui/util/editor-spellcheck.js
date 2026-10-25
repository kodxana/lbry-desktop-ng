import { Decoration, ViewPlugin } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import Typo from 'typo-js';
import affixes from './dictionaries/en_US.aff';
import dictionary from './dictionaries/en_US.dic';

let spelling;
const words = new Intl.Segmenter('en', { granularity: 'word' });
const misspelling = Decoration.mark({ class: 'cm-spell-error' });

function decorations(view) {
  if (!spelling) {
    const decoder = new TextDecoder('iso-8859-1');
    spelling = new Typo('en_US', decoder.decode(affixes), decoder.decode(dictionary), { platform: 'any' });
  }
  const marks = [];
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    for (const { segment, index, isWordLike } of words.segment(text)) {
      if (!isWordLike || /\d/.test(segment)) continue;
      const start = from + index;
      let node = syntaxTree(view.state).resolveInner(start, 1);
      let prose = true;
      while (node) {
        if (/^(FencedCode|CodeBlock|InlineCode|URL|Autolink|HTMLBlock|HTMLTag)$/.test(node.name)) {
          prose = false;
          break;
        }
        node = node.parent;
      }
      if (prose && !spelling.check(segment)) marks.push(misspelling.range(start, start + segment.length));
    }
  }
  return Decoration.set(marks);
}

export default ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = decorations(view);
    }
    update(update) {
      if (update.docChanged || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) {
        this.decorations = decorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations }
);
