import spellChecker from 'codemirror-spell-checker';
import Typo from 'typo-js';
import affixes from 'codemirror-spell-checker/src/data/en_US.aff';
import dictionary from 'codemirror-spell-checker/src/data/en_US.dic';

export default function editorSpellcheck(options) {
  if (!spellChecker.typo) {
    // Supply the existing English dictionary locally instead of the plugin's CDN requests.
    spellChecker.aff_loading = true;
    spellChecker.dic_loading = true;
    const decoder = new TextDecoder('iso-8859-1');
    spellChecker.typo = new Typo('en_US', decoder.decode(affixes), decoder.decode(dictionary), { platform: 'any' });
  }
  spellChecker(options);
}
