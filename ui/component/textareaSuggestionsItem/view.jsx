// @flow
import ChannelThumbnail from 'component/channelThumbnail';
import React from 'react';

type Props = {
  claim?: Claim,
  emote?: { name: string, url: string } | { name: string, unicode: string },
  uri?: string,
  dispatch?: (action: any) => any,
};

export default function TextareaSuggestionsItem(props: Props): React.Node {
  const { claim, emote, uri, dispatch, ...autocompleteProps } = props;

  if (emote) {
    const { name: value } = emote;
    const unicode = 'unicode' in emote ? emote.unicode : undefined;
    const url = 'url' in emote ? emote.url : undefined;

    return (
      <div {...autocompleteProps}>
        {unicode ? <div className="emote">{unicode}</div> : <img className="emote" src={url} />}

        <div className="textareaSuggestion__label">
          <span className="textareaSuggestion__title textareaSuggestion__value textareaSuggestion__value--emote">
            {value}
          </span>
        </div>
      </div>
    );
  }

  if (claim) {
    const value = claim.canonical_url.replace('lbry://', '').replace('#', ':');

    return (
      <div {...autocompleteProps}>
        <ChannelThumbnail xsmall uri={uri} />

        <div className="textareaSuggestion__label">
          <span className="textareaSuggestion__title">{(claim.value && claim.value.title) || value}</span>
          <span className="textareaSuggestion__value">{value}</span>
        </div>
      </div>
    );
  }

  return null;
}
