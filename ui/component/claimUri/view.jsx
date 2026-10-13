// @flow
import React from 'react';
import classnames from 'classnames';
import Button from 'component/button';

type Props = {
  shortUrl: ?string,
  uri: string,
  doToast: ({ message: string }) => void,
  inline?: boolean,
  noShortUrl?: boolean,
};

function ClaimUri(props: Props) {
  const { shortUrl, uri, doToast, inline = false, noShortUrl = false } = props;

  return (
    <Button
      button="link"
      className={classnames('media__uri', { 'media__uri--inline': inline })}
      label={noShortUrl ? uri : shortUrl || uri}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(shortUrl || uri);
          doToast({ message: __('Copied') });
        } catch (_) {
          doToast({ message: __('Failed to copy.'), isError: true });
        }
      }}
    />
  );
}

export default ClaimUri;
