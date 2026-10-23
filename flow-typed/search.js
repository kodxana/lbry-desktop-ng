// @flow

declare type SearchOptions = {
  // Option keys are the values in SEARCH_OPTIONS, not the constant names.
  size?: number,
  from?: number,
  claimType?: string,
  related_to?: string,
  nsfw?: boolean,
  audio?: boolean,
  video?: boolean,
  text?: boolean,
  image?: boolean,
  application?: boolean,
  sort_by?: string,
  exact?: boolean,
  free_only?: boolean,
  time_filter?: string,
  isBackgroundSearch?: boolean,
  ...
};

declare type SearchState = {
  // Search-option updates read this optional query; the reducer does not populate it.
  searchQuery?: string,
  options: SearchOptions,
  resultsByQuery: { [string]: { uris: Array<string>, recsys: string | null, ... } },
  results: Array<string>,
  // The reducer's size && comparison also preserves zero and omitted sizes.
  hasReachedMaxResultsLength: { [string]: boolean | 0 | void },
  searching: boolean,
  mentionQuery: string,
  ...
};

declare type SearchSuccess = {
  type: 'SEARCH_SUCCESS',
  data: {
    query: string,
    from: number | void,
    size: number | void,
    uris: Array<string>,
    recsys: string | null,
    ...
  },
  ...
};

declare type MentionSearchResults = {
  type: 'SET_MENTION_SEARCH_RESULTS',
  data: { query: string, uris: Array<string>, ... },
  ...
};

declare type UpdateSearchOptions = {
  type: 'UPDATE_SEARCH_OPTIONS',
  data: SearchOptions,
  ...
};
