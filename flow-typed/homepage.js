declare type HomepageCat = {
  name: string,
  icon?: string,
  label: string,
  channelIds?: Array<string>,
  daysOfContent?: number,
  channelLimit?: string,
  pageSize?: number,
  claimType?: string,
  order?: string,
  tags?: Array<string>,
  pinnedUrls?: Array<string>,
  mixIn?: Array<string>,
};

declare type HomepageData = { [string]: HomepageCat };

declare type HomepageSearchOptions = {
  feeAmount?: string,
  channelIds?: Array<string>,
  limitClaimsPerChannel?: number,
  pageSize?: number,
  languages?: Array<string>,
  claimType?: string | Array<string>,
  orderBy?: Array<string>,
  releaseTime?: string,
  streamTypes?: Array<string> | null,
  tags?: Array<string>,
};

declare type RowDataItem = {
  title: string,
  link?: string,
  help?: React$Node,
  icon?: string,
  pinnedUrls?: Array<string>,
  options?: HomepageSearchOptions,
  route?: string,
};
