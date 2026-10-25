/* eslint no-console:0 */
const assert = require('assert').strict;
const { load } = require('./testStartup');
const { findSuggestion, completeSuggestion } = load('util/comment-suggestions.js', {});
const plain = (value) => JSON.parse(JSON.stringify(value));

const source = '🙂 @first:abc\n:smile @second:def :grin!';
for (const term of ['@first:abc', ':smile', '@second:def', ':grin']) {
  const cursor = source.indexOf(term) + term.length;
  for (let repeat = 0; repeat < 3; repeat++) {
    const found = findSuggestion(source, cursor);
    assert.equal(found.term, term, 'The caret selects the token, even with preceding tokens and newlines');
    assert.equal(found.isEmote, term.startsWith(':'));
    assert.equal(source.slice(found.index, found.lastIndex), found.beforeTerm + term);
    const replacement = term.startsWith(':') ? ':smile:' : '@chosen:123abc';
    const result = completeSuggestion(source, found, replacement);
    assert.equal(result.value, source.replace(term, replacement));
    assert.equal(source, '🙂 @first:abc\n:smile @second:def :grin!', 'Parsing never mutates the draft');
  }
}
for (const cursor of [null, undefined, -1, source.length + 1, 0, 1, source.length]) {
  assert.equal(findSuggestion(source, cursor), null);
}
for (const text of ['', 'ordinary text', 'email@example.com', 'http://example.com', 'word:smile']) {
  assert.equal(findSuggestion(text, text.length), null, 'Only standalone mention/emote tokens are completed');
}
for (const text of ['@', ':', '@channel:abc', ':smile:']) {
  assert.equal(findSuggestion(text, text.length).term, text);
}
for (const suffix of ['', ' next', '\nnext', '!next', '?next']) {
  const text = 'hello :smile' + suffix;
  const found = findSuggestion(text, 'hello :smile'.length);
  const result = completeSuggestion(text, found, ':smile:');
  assert.deepEqual(plain(result), {
    value: 'hello :smile:' + (suffix || ' '),
    cursor: 'hello :smile:'.length + (!suffix || /^\s/.test(suffix) ? 1 : 0),
  });
}
const duplicate = '@same @same';
assert.equal(findSuggestion(duplicate, duplicate.length).index, 5, 'Repeated tokens use their own position');
assert.equal(findSuggestion('before :smile after', 10).term, ':smile', 'Editing inside a token keeps the full match');
console.log(
  'PASS comment suggestions: caret ranges, repeated/mixed tokens, Unicode, claim IDs, invalid positions, surrounding text and punctuation'
);
