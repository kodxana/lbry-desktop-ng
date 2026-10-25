// @flow
import { createSelector } from 'reselect';
import { selectMyCollectionIds, makeSelectClaimForUri } from 'redux/selectors/claims';
import { parseURI, isURIValid } from 'util/lbryURI';
import { isClaimPlayable } from 'util/claim';
import { findPlayableUrl } from 'util/collection-playback';

type State = {
  collections: CollectionState,
  content: CollectionPlaybackState,
  claims: ClaimsState,
  ...
};
type CollectionSelector<T> = (state: State) => T;
const selectState = (state: State): CollectionState => state.collections;
const selectShuffleList = (state: State): CollectionPlaybackState['shuffleList'] => state.content.shuffleList;
const selectLoopList = (state: State): CollectionPlaybackState['loopList'] => state.content.loopList;

export const selectSavedCollectionIds: CollectionSelector<Array<string>> = createSelector(
  selectState,
  (collectionState) => collectionState.saved
);

export const selectBuiltinCollections: CollectionSelector<CollectionGroup> = createSelector(
  selectState,
  (state) => state.builtin
);
export const selectResolvedCollections: CollectionSelector<CollectionGroup> = createSelector(
  selectState,
  (state) => state.resolved
);

export const selectMyUnpublishedCollections: CollectionSelector<CollectionGroup> = createSelector(
  selectState,
  (state) => state.unpublished
);

export const selectMyEditedCollections: CollectionSelector<CollectionGroup> = createSelector(
  selectState,
  (state) => state.edited
);

export const selectPendingCollections: CollectionSelector<CollectionGroup> = createSelector(
  selectState,
  (state) => state.pending
);

export const selectLastUsedCollection: CollectionSelector<string | void> = createSelector(
  selectState,
  (state) => state.lastUsedCollection
);

export const makeSelectEditedCollectionForId = (id: string): CollectionSelector<Collection | void> =>
  createSelector(selectMyEditedCollections, (eLists) => eLists[id]);

export const makeSelectPendingCollectionForId = (id: string): CollectionSelector<Collection | void> =>
  createSelector(selectPendingCollections, (pending) => pending[id]);

export const makeSelectPublishedCollectionForId = (id: string): CollectionSelector<Collection | void> =>
  createSelector(selectResolvedCollections, (rLists) => rLists[id]);

export const makeSelectUnpublishedCollectionForId = (id: string): CollectionSelector<Collection | void> =>
  createSelector(selectMyUnpublishedCollections, (rLists) => rLists[id]);

export const makeSelectCollectionIsMine = (id: string): CollectionSelector<boolean> =>
  createSelector(
    selectMyCollectionIds,
    selectMyUnpublishedCollections,
    selectBuiltinCollections,
    (publicIds, privateIds, builtinIds) => {
      return Boolean(publicIds.includes(id) || privateIds[id] || builtinIds[id]);
    }
  );

export const selectMyPublishedCollections: CollectionSelector<CollectionGroup> = createSelector(
  selectResolvedCollections,
  selectPendingCollections,
  selectMyEditedCollections,
  selectMyCollectionIds,
  (resolved, pending, edited, myIds) => {
    // all resolved in myIds, plus those in pending and edited
    const myPublishedCollections: CollectionGroup = { ...pending };
    Object.keys(resolved).forEach((id) => {
      if (myIds.includes(id) && !pending[id]) myPublishedCollections[id] = resolved[id];
    });
    Object.keys(edited).forEach((id) => {
      myPublishedCollections[id] = edited[id];
    });
    return myPublishedCollections;
  }
);

export const selectMyPublishedMixedCollections: CollectionSelector<CollectionGroup> = createSelector(
  selectMyPublishedCollections,
  (published) => {
    const myCollections: CollectionGroup = {};
    Object.keys(published).forEach((id) => {
      if (published[id].type === 'collection') myCollections[id] = published[id];
    });
    return myCollections;
  }
);

export const selectMyPublishedPlaylistCollections: CollectionSelector<CollectionGroup> = createSelector(
  selectMyPublishedCollections,
  (published) => {
    const myCollections: CollectionGroup = {};
    Object.keys(published).forEach((id) => {
      if (published[id].type === 'playlist') myCollections[id] = published[id];
    });
    return myCollections;
  }
);

export const makeSelectMyPublishedCollectionForId = (id: string): CollectionSelector<Collection | void> =>
  createSelector(selectMyPublishedCollections, (myPublishedCollections) => myPublishedCollections[id]);

export const makeSelectIsResolvingCollectionForId = (id: string): CollectionSelector<boolean | void> =>
  createSelector(selectState, (state) => {
    return state.isResolvingCollectionById[id];
  });

export const makeSelectCollectionForId = (id: ?string): CollectionSelector<Collection | void> =>
  createSelector(
    selectBuiltinCollections,
    selectResolvedCollections,
    selectMyUnpublishedCollections,
    selectMyEditedCollections,
    selectPendingCollections,
    (bLists, rLists, uLists, eLists, pLists) => {
      const collection = id ? bLists[id] || uLists[id] || eLists[id] || pLists[id] || rLists[id] : undefined;
      return collection;
    }
  );

export const makeSelectClaimUrlInCollection = (url: string): CollectionSelector<boolean> =>
  createSelector(
    selectBuiltinCollections,
    selectMyPublishedCollections,
    selectMyUnpublishedCollections,
    selectMyEditedCollections,
    selectPendingCollections,
    (bLists, myRLists, uLists, eLists, pLists) => {
      const collections = [bLists, uLists, eLists, myRLists, pLists];
      return collections.some((list) => Object.keys(list).some((id) => list[id].items.includes(url)));
    }
  );

export const makeSelectCollectionForIdHasClaimUrl = (id: ?string, url: string): CollectionSelector<boolean | void> =>
  createSelector(makeSelectCollectionForId(id), (collection) => collection && collection.items.includes(url));

export const makeSelectUrlsForCollectionId = (id: string): CollectionSelector<Array<?string> | void> =>
  createSelector(makeSelectCollectionForId(id), (collection) => collection && collection.items);

export const makeSelectClaimIdsForCollectionId = (id: string): CollectionSelector<Array<string>> =>
  createSelector(makeSelectCollectionForId(id), (collection) => {
    const items = (collection && collection.items) || [];
    const ids: Array<string> = [];
    items.forEach((item) => {
      if (!item || !isURIValid(item)) return;
      const { claimId } = parseURI(item);
      if (claimId) ids.push(claimId);
    });
    return ids;
  });

const makeSelectPlaybackUrls = (id: string, ignoreShuffle?: boolean): CollectionSelector<Array<?string> | void> =>
  createSelector(selectShuffleList, makeSelectUrlsForCollectionId(id), (shuffleState, urls) => {
    return !ignoreShuffle && shuffleState && shuffleState.collectionId === id && shuffleState.newUrls
      ? shuffleState.newUrls
      : urls;
  });

export const makeSelectIndexForUrlInCollection = (
  url: string,
  id: string,
  ignoreShuffle?: boolean
): CollectionSelector<number> =>
  createSelector(makeSelectPlaybackUrls(id, ignoreShuffle), makeSelectClaimForUri(url), (urls, claim: ?Claim) => {
    if (!urls) return -1;
    const index = urls.indexOf(url);
    if (index !== -1) return index;
    return claim ? urls.indexOf(claim.permanent_url) : -1;
  });

export const makeSelectPreviousUrlForCollectionAndUrl = (id: string, url: string): CollectionSelector<string | null> =>
  createSelector(
    selectLoopList,
    makeSelectIndexForUrlInCollection(url, id),
    makeSelectPlaybackUrls(id),
    (loopState, index, urls) => {
      if (!urls || index < 0) return null;
      const loop = loopState && loopState.collectionId === id && loopState.loop;
      return urls[index === 0 && loop ? urls.length - 1 : index - 1] || null;
    }
  );

export const makeSelectNextUrlForCollectionAndUrl = (id: string, url: string): CollectionSelector<string | null> =>
  createSelector(
    selectLoopList,
    makeSelectIndexForUrlInCollection(url, id),
    makeSelectPlaybackUrls(id),
    (loopState, index, urls) => {
      if (!urls || index < 0) return null;
      const loop = loopState && loopState.collectionId === id && loopState.loop;
      return urls[index === urls.length - 1 && loop ? 0 : index + 1] || null;
    }
  );

const makeSelectPlayableUrl = (id: string, url: string, direction: -1 | 1): CollectionSelector<string | null> =>
  createSelector(
    (state: State) => state,
    makeSelectIndexForUrlInCollection(url, id),
    makeSelectPlaybackUrls(id),
    (state, index, urls) => {
      const loopState = state.content.loopList;
      const loop = Boolean(loopState && loopState.collectionId === id && loopState.loop);
      return findPlayableUrl(urls || [], index, direction, loop, (candidate) =>
        isClaimPlayable(makeSelectClaimForUri(candidate)(state))
      );
    }
  );

export const makeSelectPrevPlayableUrlFromCollectionAndUrl = (
  collectionId: string,
  url: string
): CollectionSelector<string | null> => makeSelectPlayableUrl(collectionId, url, -1);

export const makeSelectNextPlayableUrlFromCollectionAndUrl = (
  collectionId: string,
  url: string
): CollectionSelector<string | null> => makeSelectPlayableUrl(collectionId, url, 1);

export const makeSelectNameForCollectionId = (id: string): CollectionSelector<string> =>
  createSelector(makeSelectCollectionForId(id), (collection) => {
    return (collection && collection.name) || '';
  });

export const makeSelectCountForCollectionId = (id: string): CollectionSelector<number | null> =>
  createSelector(makeSelectCollectionForId(id), (collection) => {
    if (collection) {
      if (collection.itemCount !== undefined) {
        return collection.itemCount;
      }
      let itemCount = 0;
      collection.items.map((item) => {
        if (item) {
          itemCount += 1;
        }
      });
      return itemCount;
    }
    return null;
  });
