declare type Collection = {
  id: string,
  items: Array<?string>,
  name: string,
  type: string,
  updatedAt: number,
  totalItems?: number,
  itemCount?: number,
  sourceId?: string, // if copied, claimId of original collection
  ...
};

declare type CollectionState = {
  unpublished: CollectionGroup,
  resolved: CollectionGroup,
  pending: CollectionGroup,
  edited: CollectionGroup,
  builtin: CollectionGroup,
  saved: Array<string>,
  lastUsedCollection?: string,
  isResolvingCollectionById: { [string]: boolean },
  error?: string | null,
  ...
};

declare type CollectionGroup = {
  [string]: Collection,
};

declare type CollectionPlaybackState = {
  shuffleList?: { collectionId: string, newUrls: Array<?string> | false, ... },
  loopList?: { collectionId: string, loop: boolean, ... },
  ...
};

declare type CollectionEditParams = {
  uris?: Array<string>,
  remove?: boolean,
  replace?: boolean,
  order?: { from: number, to: number, ... },
  type?: string,
  name?: string,
  ...
};
