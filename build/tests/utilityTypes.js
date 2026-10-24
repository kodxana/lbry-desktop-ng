// @flow
import { parseQueryParams, updateQueryParam, getSearchQueryString } from 'util/query-params';
import { getFormatter } from 'util/intlNumberFormat';
import { formatNumber, formatNumberWithCommas, isTrulyANumber } from 'util/number';
import { formatBytes } from 'util/format-bytes';
import { formatCredits, formatFullPrice, creditsToString } from 'util/format-credits';
import { toCapitalCase, toCompactNotation } from 'util/string';
import { secondsToHms, hmsToSeconds } from 'util/time';
import { walletSyncProgress, readWalletSnapshot } from 'util/wallet-sync';
import { startupProgress } from 'util/startup-progress';
import { sortComments, buildValidSticker, parseSticker, getStickerUrl, getCommentsListTitle } from 'util/comments';
import type { Sticker } from 'constants/stickers';
import type { WalletSyncProgress } from 'util/wallet-sync';
import type { StartupProgress } from 'util/startup-progress';

declare var status: StatusResponse;
declare var comments: Array<LbryComment>;
export const sortedComments: Array<LbryComment> = sortComments({
  comments,
  reactionsById: { id: { like: 2, dislike: 1 } },
  sort: 'new',
  isMyComment: (id: string) => id === 'mine',
});
export const stickerText: string = buildValidSticker(':HYPE:');
export const sticker: Sticker | false | null | void = parseSticker(stickerText);
export const stickerUrl: string | false | null | void = getStickerUrl(stickerText);
export const commentTitle: string = getCommentsListTitle(10);
const balance: BalanceResponse = {
  available: '1.00000001',
  total: '1.00000001',
  reserved: '0',
  reserved_subtotals: null,
};
const sdk = {
  status: async (): Promise<StatusResponse> => status,
  wallet_balance: async (): Promise<BalanceResponse> => balance,
  extra: true,
};
export const strings: Array<string> = [
  getFormatter('en', { maximumFractionDigits: 8 }).format(1),
  formatNumber(1, 8),
  formatNumberWithCommas(1),
  formatBytes(1024),
  formatCredits('1.00000001', 8),
  formatCredits(null),
  creditsToString('0.00000001'),
  toCapitalCase('wallet'),
  toCompactNotation(1000, null, 1000),
  secondsToHms(60),
];
export const price: number = formatFullPrice('0.00000001', 2);
export const seconds: number = hmsToSeconds('01:00');
export const numeric: boolean = isTrulyANumber('not a number');
export const history: WalletSyncProgress = walletSyncProgress(undefined);
export const startup: StartupProgress = startupProgress(null, true);
export async function snapshotValues(): Promise<[string, ?StatusResponse]> {
  const snapshot = await readWalletSnapshot(sdk);
  return [snapshot.balance.total, snapshot.status];
}

export const searchQuery: string = getSearchQueryString('café / video', {
  size: 5,
  from: 20,
  nsfw: false,
  claimType: 'file',
  video: true,
  exact: true,
  isBackgroundSearch: false,
});
export const queryValues: { [string]: string | void } = parseQueryParams('?flag&empty=');
export const updatedQuery: string = updateQueryParam('/search?q=old', 'q', 'new');
export function searchResult(state: SearchState): [Array<string>, string | null, boolean | 0 | void] {
  const result = state.resultsByQuery['query'];
  return [result.uris, result.recsys, state.hasReachedMaxResultsLength['query']];
}

export const homepageCategory: HomepageCat = {
  name: 'science',
  label: 'Science',
  channelLimit: 'auto',
  channelIds: ['abc'],
  pageSize: 8,
};
export const homepageData: HomepageData = { SCIENCE: homepageCategory };
export const homepageRow: RowDataItem = {
  title: 'Science',
  pinnedUrls: ['lbry://video#abc'],
  options: {
    claimType: ['stream'],
    channelIds: ['abc'],
    orderBy: ['release_time'],
    releaseTime: '>1',
    streamTypes: null,
    tags: ['science'],
    languages: ['en'],
    pageSize: 8,
  },
};
