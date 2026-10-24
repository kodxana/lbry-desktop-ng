// @flow

declare type PlayingUri = {
  uri: ?string,
  primaryUri: ?string,
  pathname?: string,
  commentId?: string,
  source?: string,
  collectionId?: string,
  ...
};

declare type ContentHistoryItem = { uri: string, lastViewed: number };

declare type ContentState = {
  primaryUri: ?string,
  playingUri: ?PlayingUri,
  positions: { [string]: { [string]: ?number } },
  history: Array<ContentHistoryItem>,
  loopList?: { collectionId: string, loop: boolean },
  shuffleList?: { collectionId: string, newUrls: Array<?string> },
  ...
};
