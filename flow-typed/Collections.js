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

declare type CollectionDropResult = {
  source: { index: number, ... },
  destination: ?{ index: number, ... },
  ...
};

declare type CollectionMetadataOptions = {
  name?: string,
  claim_id?: string,
  bid?: string | number,
  blocking?: true,
  title?: string,
  channel_id?: string,
  thumbnail_url?: string,
  description?: string,
  tags?: Array<Tag>,
  languages?: Array<string>,
  locations?: Array<ClaimLocation>,
  claims?: Array<string>,
};

declare type CollectionCreateOptions = Readonly<{
  ...CollectionMetadataOptions,
  name: string,
  bid: string | number,
  claims: Array<string>,
}>;

declare type CollectionUpdateOptions = Readonly<{
  ...CollectionMetadataOptions,
  claim_id: string,
}>;

declare type CollectionFormData = {
  ...CollectionCreateOptions,
  claim_id?: string,
  tags: Array<Tag>,
  languages: Array<string>,
  locations: Array<ClaimLocation>,
};
