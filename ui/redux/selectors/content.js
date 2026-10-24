// @flow
import { createSelector } from 'reselect';
import {
  makeSelectClaimForUri,
  selectClaimIsNsfwForUri,
  selectClaimIsMineForUri,
  makeSelectClaimIsNsfw,
  makeSelectContentTypeForUri,
} from 'redux/selectors/claims';
import { makeSelectMediaTypeForUri, makeSelectFileNameForUri } from 'redux/selectors/file_info';
import { selectBalance } from 'redux/selectors/wallet';
import { selectCostInfoForUri } from 'lbryinc';
import { selectShowMatureContent } from 'redux/selectors/settings';
import * as RENDER_MODES from 'constants/file_render_modes';
import path from 'util/file-name';
import { FORCE_CONTENT_TYPE_PLAYER, FORCE_CONTENT_TYPE_COMIC } from 'constants/claim';

const RECENT_HISTORY_AMOUNT = 10;
const HISTORY_ITEMS_PER_PAGE = 50;

type State = { claims: ClaimsState, content?: ContentState, ... };
type ContentSelector<T> = (state: State) => T;
const EMPTY_CONTENT: ContentState = { primaryUri: null, playingUri: null, positions: {}, history: [] };

export const selectState = (state: State): ContentState => state.content || EMPTY_CONTENT;

export const selectPlayingUri = (state: State): ?PlayingUri => selectState(state).playingUri;
export const selectPrimaryUri = (state: State): ?string => selectState(state).primaryUri;
export const selectListLoop = (state: State): ContentState['loopList'] => selectState(state).loopList;
export const selectListShuffle = (state: State): ContentState['shuffleList'] => selectState(state).shuffleList;

export const makeSelectIsPlaying = (uri: string): ContentSelector<boolean> =>
  createSelector(selectPrimaryUri, (primaryUri) => primaryUri === uri);

export const makeSelectIsPlayerFloating = (
  location: Readonly<{ pathname: string, search?: string, ... }>
): ContentSelector<boolean> =>
  createSelector(selectPrimaryUri, selectPlayingUri, (primaryUri, playingUri) => {
    if (!playingUri || !playingUri.uri) return false;

    const { pathname, search } = location;
    const hasSecondarySource = Boolean(playingUri.source);
    const isComment = playingUri.source === 'comment';
    const isInlineSecondaryPlayer =
      hasSecondarySource && playingUri.uri !== primaryUri && pathname === playingUri.pathname;

    if (isComment && isInlineSecondaryPlayer && search && search !== '?view=discussion') return true;

    if (
      isInlineSecondaryPlayer ||
      (hasSecondarySource && !isComment ? playingUri.primaryUri === primaryUri : playingUri.uri === primaryUri)
    ) {
      return false;
    }

    return true;
  });

export const makeSelectContentPositionForUri = (uri: string): ContentSelector<?number> =>
  createSelector(selectState, makeSelectClaimForUri(uri), (state, claim) => {
    if (!claim) {
      return null;
    }
    const outpoint = `${claim.txid}:${claim.nout}`;
    const id = claim.claim_id;
    return state.positions[id] ? state.positions[id][outpoint] : null;
  });

export const makeSelectContentWatchedPercentageForUri = (uri: string): ContentSelector<number> =>
  createSelector(selectState, makeSelectClaimForUri(uri), (state, claim) => {
    if (!claim) {
      return 0;
    }
    const media = claim.value_type === 'stream' && (claim.value.video || claim.value.audio);
    if (!media) {
      return 0;
    }
    const id = claim.claim_id;
    if (!state.positions[id]) {
      return 0;
    }
    const outpoint = `${claim.txid}:${claim.nout}`;
    const watched = state.positions[id][outpoint];
    // If the user turns on the persist watch setting,
    // clearing the position will set it to null,
    // which means the entire video has been watched.
    if (watched === null) {
      return 100;
    }
    const duration = media.duration;
    return typeof watched === 'number' &&
      Number.isFinite(watched) &&
      typeof duration === 'number' &&
      Number.isFinite(duration) &&
      duration > 0
      ? (watched / duration) * 100
      : 0;
  });

export const selectHistory: ContentSelector<Array<ContentHistoryItem>> = createSelector(
  selectState,
  (state) => state.history || []
);

export const selectHistoryPageCount: ContentSelector<number> = createSelector(selectHistory, (history) =>
  Math.ceil(history.length / HISTORY_ITEMS_PER_PAGE)
);

export const makeSelectHistoryForPage = (page: number): ContentSelector<Array<ContentHistoryItem>> =>
  createSelector(selectHistory, (history) => {
    const left = page * HISTORY_ITEMS_PER_PAGE;
    const historyItemsForPage = history.slice(left, left + HISTORY_ITEMS_PER_PAGE);
    return historyItemsForPage;
  });

export const makeSelectHistoryForUri = (uri: string): ContentSelector<ContentHistoryItem | void> =>
  createSelector(selectHistory, (history) => history.find((i) => i.uri === uri));

export const makeSelectHasVisitedUri = (uri: string): ContentSelector<boolean> =>
  createSelector(makeSelectHistoryForUri(uri), (history) => Boolean(history));

export const selectRecentHistory: ContentSelector<Array<ContentHistoryItem>> = createSelector(
  selectHistory,
  (history) => {
    return history.slice(0, RECENT_HISTORY_AMOUNT);
  }
);

export const selectShouldObscurePreviewForUri = (state: State, uri: string): boolean => {
  const showMatureContent = selectShowMatureContent(state);
  const isClaimMature = selectClaimIsNsfwForUri(state, uri);
  return isClaimMature && !showMatureContent;
};

// deprecated
export const makeSelectShouldObscurePreview = (uri: string): ContentSelector<boolean> =>
  createSelector(selectShowMatureContent, makeSelectClaimIsNsfw(uri), (showMatureContent, isClaimMature) => {
    return isClaimMature && !showMatureContent;
  });

// should probably be in lbry-redux, yarn link was fighting me
export const makeSelectFileExtensionForUri = (uri: string): ContentSelector<?string> =>
  createSelector(makeSelectFileNameForUri(uri), (fileName) => {
    return fileName && path.extname(fileName).substring(1);
  });

export const makeSelectFileRenderModeForUri = (uri: string): ContentSelector<string> =>
  createSelector(
    makeSelectContentTypeForUri(uri),
    makeSelectMediaTypeForUri(uri),
    makeSelectFileExtensionForUri(uri),
    (contentType = '', mediaType = '', extension) => {
      if (mediaType === 'video' || FORCE_CONTENT_TYPE_PLAYER.includes(contentType)) {
        return RENDER_MODES.VIDEO;
      }
      if (mediaType === 'audio') {
        return RENDER_MODES.AUDIO;
      }
      if (mediaType === 'image') {
        return RENDER_MODES.IMAGE;
      }
      if ((extension && ['md', 'markdown'].includes(extension)) || ['text/md', 'text/markdown'].includes(contentType)) {
        return RENDER_MODES.MARKDOWN;
      }
      if (contentType === 'application/pdf') {
        return RENDER_MODES.PDF;
      }
      if (['text/htm', 'text/html'].includes(contentType)) {
        return RENDER_MODES.HTML;
      }
      if (['text', 'document', 'script'].includes(mediaType)) {
        return RENDER_MODES.DOCUMENT;
      }
      if (extension === 'docx') {
        return RENDER_MODES.DOCX;
      }

      // when writing this my local copy of Lbry.getMediaType had '3D-file', but I was receiving model...'
      if (['3D-file', 'model'].includes(mediaType)) {
        return RENDER_MODES.CAD;
      }
      // Force content type for fallback support of older claims
      if (mediaType === 'comic-book' || FORCE_CONTENT_TYPE_COMIC.includes(contentType)) {
        return RENDER_MODES.COMIC;
      }
      if (
        [
          'application/zip',
          'application/x-gzip',
          'application/x-gtar',
          'application/x-tgz',
          'application/vnd.rar',
          'application/x-7z-compressed',
        ].includes(contentType)
      ) {
        return RENDER_MODES.DOWNLOAD;
      }

      if (mediaType === 'application') {
        return RENDER_MODES.APPLICATION;
      }

      return RENDER_MODES.UNSUPPORTED;
    }
  );

export const selectInsufficientCreditsForUri = (state: State, uri: string): boolean => {
  const isMine = selectClaimIsMineForUri(state, uri);
  const costInfo = selectCostInfoForUri(state, uri);
  const balance = selectBalance(state);
  return Boolean(!isMine && costInfo && costInfo.cost > 0 && costInfo.cost > balance);
};
