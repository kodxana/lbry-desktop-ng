import { EMOTES_48px as EMOTES } from 'constants/emotes';
import inlineToken from 'util/remark-inline-token';
import { get as getEmoji } from 'node-emoji';

const emotes = new Map(EMOTES.map((emote) => [emote.name, emote.url]));

export default function remarkEmote() {
  inlineToken(this, {
    name: 'lbryEmote',
    start: ':',
    accepts: (character, value) => (!value || !value.endsWith(':') || value.length === 1) && /[\w:+-]/.test(character),
    match: (value) => (emotes.has(value.toUpperCase()) || getEmoji(value) ? value : null),
    node: (value, parents) => {
      const url = emotes.get(value.toUpperCase());
      if (!url) return { type: 'text', value: getEmoji(value) };
      return parents[parents.length - 1].type === 'paragraph' ? { type: 'image', url, title: value, alt: value } : null;
    },
  });
}
