// @flow

const SUGGESTION_REGEX = new RegExp(
  '(?<Mention>(?:^| |\n)@[^\\s=&#$@%?:;/\\"<>%{}|^~[]*(?::[\\w]+)?)|(?<Emote>(?:^| |\n):[\\w+-]*:?)',
  'gm'
);

/** Regex Explained step-by-step:
 *
 * 1) (?<Name>....) = naming a match into a possible group (either Mention or Emote)
 * 2) (?:^| |\n) = only allow for: sentence beginning, space or newline before the match (no words or symbols)
 * 3) [^\s=&#$@%?:;/\\"<>%{}|^~[]* = anything, except the characters inside
 * 4) (?::[\w]+)? = A mention can be matched with a ':' as a claim modifier with words or digits after as ID digits,
 * or else it's everything before the ':' (will then match the winning uri for the mention behind since has no canonical ID)
 * 5) :\w*:? = the emote Regex, possible to be matched with a ':' at the end to consider previously typed emotes
 *
 */

export type Suggestion = {
  beforeTerm: string,
  term: string,
  index: number,
  lastIndex: number,
  isEmote: boolean,
};

export function findSuggestion(value: string, cursor: ?number): Suggestion | null {
  if (cursor == null || cursor < 0 || cursor > value.length) return null;
  for (const match of value.matchAll(SUGGESTION_REGEX)) {
    const index = match.index;
    const lastIndex = index + match[0].length;
    if (cursor < index || cursor > lastIndex) continue;
    const isEmote = !!match.groups?.Emote;
    const tokenIndex = match[0].indexOf(isEmote ? ':' : '@');
    return {
      beforeTerm: match[0].substring(0, tokenIndex),
      term: match[0].substring(tokenIndex),
      index,
      lastIndex,
      isEmote,
    };
  }
  return null;
}

export function completeSuggestion(
  value: string,
  suggestion: Suggestion,
  selected: string
): { value: string, cursor: number } {
  const before = value.substring(0, suggestion.index) + suggestion.beforeTerm;
  const after = value.substring(suggestion.lastIndex) || ' ';
  return {
    value: before + selected + after,
    cursor: before.length + selected.length + (/^\s/.test(after) ? 1 : 0),
  };
}
