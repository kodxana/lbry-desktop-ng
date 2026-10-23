// @flow
import 'scss/component/_emote-selector.scss';
import { EMOTES_48px as EMOTES } from 'constants/emotes';
import * as ICONS from 'constants/icons';
import Button from 'component/button';
import { get as getEmoji } from 'node-emoji';
import OptimizedImage from 'component/optimizedImage';
import React from 'react';

const QUICK_EMOJIS = ['rocket', 'jeans', 'fire', 'heart', 'open_mouth'];

type Props = { commentValue: string, setCommentValue: (string) => void, closeSelector: () => void };

export default function EmoteSelector(props: Props) {
  const { commentValue, setCommentValue, closeSelector } = props;

  function addEmoteToComment(emote: string) {
    setCommentValue(
      commentValue + (commentValue && commentValue.charAt(commentValue.length - 1) !== ' ' ? ` ${emote} ` : `${emote} `)
    );
  }

  return (
    <div className="emoteSelector">
      <Button button="close" icon={ICONS.REMOVE} onClick={closeSelector} />

      <div className="emoteSelector__list">
        <div className="emoteSelector__listRow">
          <div className="emoteSelector__listRowItems">
            {QUICK_EMOJIS.map((name) => (
              <Button
                key={name}
                label={getEmoji(name)}
                title={`:${name}:`}
                button="alt"
                className="button--file-action"
                onClick={() => addEmoteToComment(getEmoji(name))}
              />
            ))}
            {EMOTES.map((emote) => {
              const emoteName = emote.name.toLowerCase();

              return (
                <Button
                  key={emoteName}
                  title={emoteName}
                  button="alt"
                  className="button--file-action"
                  onClick={() => addEmoteToComment(emoteName)}
                >
                  <OptimizedImage src={emote.url} waitLoad />
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
