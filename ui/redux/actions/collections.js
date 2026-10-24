// @flow
import * as ACTIONS from 'constants/action_types';
import { v4 as uuid } from 'uuid';
import Lbry from 'lbry';
import { doClaimSearch, doAbandonClaim } from 'redux/actions/claims';
import { makeSelectClaimForClaimId } from 'redux/selectors/claims';
import {
  makeSelectCollectionForId,
  // makeSelectPublishedCollectionForId, // for "save" or "copy" action
  makeSelectPublishedCollectionForId,
  makeSelectUnpublishedCollectionForId,
  makeSelectEditedCollectionForId,
} from 'redux/selectors/collections';
import * as COLS from 'constants/collections';

const getTimestamp = () => {
  return Math.floor(Date.now() / 1000);
};

const FETCH_BATCH_SIZE = 50;
type CollectionItemsResult = { claimId: string, items: Array<Claim> | null };

export const doLocalCollectionCreate =
  (
    name: string,
    collectionItems: Array<string>,
    type: string,
    sourceId?: string
  ): ThunkAction<{ type: string, data: { entry: Collection } }> =>
  (dispatch: Dispatch) => {
    return dispatch({
      type: ACTIONS.COLLECTION_NEW,
      data: {
        entry: {
          id: uuid(), // start with a uuid, this becomes a claimId after publish
          name: name,
          updatedAt: getTimestamp(),
          items: collectionItems || [],
          sourceId: sourceId,
          type: type,
        },
      },
    });
  };

export const doCollectionDelete =
  (id: string, colKey: ?string = undefined): ThunkAction<unknown> =>
  (dispatch: Dispatch, getState: GetState) => {
    const state = getState();
    const claim = makeSelectClaimForClaimId(id)(state);
    const collectionDelete = () =>
      dispatch({
        type: ACTIONS.COLLECTION_DELETE,
        data: {
          id: id,
          collectionKey: colKey,
        },
      });
    if (claim && !colKey) {
      // could support "abandon collection claim, but keep private collection" later
      return dispatch(doAbandonClaim(claim, collectionDelete));
    }
    return collectionDelete();
  };

// Given a collection, save its collectionId to be resolved and displayed in Library
// export const doCollectionSave = (
//   id: string,
// ) => (dispatch: Dispatch) => {
//   return dispatch({
//     type: ACTIONS.COLLECTION_SAVE,
//     data: {
//       id: id,
//     },
//   });
// };

// Given a collection and name, copy it to a local private collection with a name
// export const doCollectionCopy = (
//   id: string,
// ) => (dispatch: Dispatch) => {
//   return dispatch({
//     type: ACTIONS.COLLECTION_COPY,
//     data: {
//       id: id,
//     },
//   });
// };

export const doFetchItemsInCollections =
  (
    resolveItemsOptions: {
      collectionIds: Array<string>,
      pageSize?: number,
    },
    resolveStartedCallback?: () => void
  ): ThunkAction<Promise<void>> =>
  async (dispatch: Dispatch, getState: GetState) => {
    /*
  1) make sure all the collection claims are loaded into claims reducer, search/resolve if necessary.
  2) get the item claims for each
  3) format and make sure they're in the order as in the claim
  4) Build the collection objects and update collections reducer
  5) Update redux claims reducer
   */
    let state = getState();
    const { collectionIds, pageSize } = resolveItemsOptions;

    dispatch({
      type: ACTIONS.COLLECTION_ITEMS_RESOLVE_STARTED,
      data: { ids: collectionIds },
    });

    if (resolveStartedCallback) resolveStartedCallback();

    const collectionIdsToSearch = collectionIds.filter((claimId) => !state.claims.byId[claimId]);

    if (collectionIdsToSearch.length) {
      await dispatch(doClaimSearch({ claim_ids: collectionIdsToSearch, page: 1, page_size: 9999 }));
    }

    const stateAfterClaimSearch = getState();

    async function fetchItemsForCollectionClaim(
      claim: CollectionClaim,
      pageSize?: number
    ): Promise<CollectionItemsResult> {
      const totalItems = claim.value.claims && claim.value.claims.length;
      const claimId = claim.claim_id;
      const itemOrder = claim.value.claims;

      const sortResults = (items: Array<Claim>, claimList: Array<string>): Array<Claim> => {
        const newItems: Array<Claim> = [];
        claimList.forEach((id) => {
          const index = items.findIndex((i) => i.claim_id === id);
          if (index >= 0) {
            newItems.push(items[index]);
          }
        });
        /*
        This will return newItems[] of length less than total_items below
        if one or more of the claims has been abandoned. That's ok for now.
      */
        return newItems;
      };

      try {
        const batchSize = pageSize || FETCH_BATCH_SIZE;
        const batches: Array<Promise<ClaimSearchResponse>> = [];

        for (let i = 0; i < Math.ceil(totalItems / batchSize); i++) {
          batches[i] = Lbry.claim_search({
            claim_ids: claim.value.claims.slice(i * batchSize, (i + 1) * batchSize),
            page: 1,
            page_size: batchSize,
            no_totals: true,
          });
        }
        const itemsInBatches = await Promise.all(batches);
        return {
          claimId,
          items: sortResults(
            itemsInBatches.flatMap((result) => result.items),
            itemOrder
          ),
        };
      } catch (e) {
        return {
          claimId: claimId,
          items: null,
        };
      }
    }

    function formatForClaimActions(resultClaimsByUri: { [string]: Claim }): { [string]: ClaimResolveResult } {
      const formattedClaims: { [string]: ClaimResolveResult } = {};
      Object.entries(resultClaimsByUri).forEach(([uri, uriResolveInfo]) => {
        if (uriResolveInfo) {
          const result: ClaimResolveResult = {};
          if (uriResolveInfo.value_type === 'channel') {
            result.channel = uriResolveInfo;
            result.claimsInChannel = uriResolveInfo.meta.claims_in_channel;
            // ALSO SKIP COLLECTIONS
          } else if (uriResolveInfo.value_type === 'collection') {
            result.collection = uriResolveInfo;
          } else {
            result.stream = uriResolveInfo;
            if (uriResolveInfo.signing_channel) {
              result.channel = uriResolveInfo.signing_channel;
              result.claimsInChannel =
                (uriResolveInfo.signing_channel.meta && uriResolveInfo.signing_channel.meta.claims_in_channel) || 0;
            }
          }
          formattedClaims[uri] = result;
        }
      });
      return formattedClaims;
    }

    const invalidCollectionIds = [];
    const promisedCollectionItemFetches = [];
    collectionIds.forEach((collectionId) => {
      const claim = makeSelectClaimForClaimId(collectionId)(stateAfterClaimSearch);
      if (!claim || claim.value_type !== 'collection') {
        invalidCollectionIds.push(collectionId);
      } else {
        promisedCollectionItemFetches.push(fetchItemsForCollectionClaim(claim, pageSize));
      }
    });

    const collectionItemsById = await Promise.all(promisedCollectionItemFetches);

    const newCollectionObjectsById: CollectionGroup = {};
    const resolvedItemsByUrl: { [string]: Claim } = {};
    collectionItemsById.forEach((entry) => {
      const collectionItems = entry.items;
      const collectionId = entry.claimId;
      if (collectionItems) {
        const claim = makeSelectClaimForClaimId(collectionId)(stateAfterClaimSearch);

        const editedCollection = makeSelectEditedCollectionForId(collectionId)(stateAfterClaimSearch);
        if (!claim || claim.value_type !== 'collection') {
          invalidCollectionIds.push(collectionId);
          return;
        }
        const { name, timestamp, value } = claim;
        const { title } = value;
        const valueTypes = new Set<string>();
        const streamTypes = new Set<string>();

        let newItems: Array<?string> = [];
        let isPlaylist;

        if (collectionItems) {
          collectionItems.forEach((collectionItem) => {
            newItems.push(collectionItem.permanent_url);
            valueTypes.add(collectionItem.value_type);
            if (collectionItem.value_type === 'stream') {
              streamTypes.add(collectionItem.value.stream_type);
            }
            resolvedItemsByUrl[collectionItem.canonical_url] = collectionItem;
          });
          isPlaylist =
            valueTypes.size === 1 &&
            valueTypes.has('stream') &&
            ((streamTypes.size === 1 && (streamTypes.has('audio') || streamTypes.has('video'))) ||
              (streamTypes.size === 2 && streamTypes.has('audio') && streamTypes.has('video')));
        }

        newCollectionObjectsById[collectionId] = {
          items: newItems,
          id: collectionId,
          name: title || name,
          itemCount: claim.value.claims.length,
          type: isPlaylist ? 'playlist' : 'collection',
          updatedAt: timestamp ?? 0,
        };

        if (editedCollection && timestamp !== undefined && timestamp > editedCollection['updatedAt']) {
          dispatch({
            type: ACTIONS.COLLECTION_DELETE,
            data: {
              id: collectionId,
              collectionKey: 'edited',
            },
          });
        }
      } else {
        invalidCollectionIds.push(collectionId);
      }
    });
    const formattedClaimsByUri = formatForClaimActions(resolvedItemsByUrl);

    dispatch({
      type: ACTIONS.RESOLVE_URIS_COMPLETED,
      data: { resolveInfo: formattedClaimsByUri },
    });

    dispatch({
      type: ACTIONS.COLLECTION_ITEMS_RESOLVE_COMPLETED,
      data: {
        resolvedCollections: newCollectionObjectsById,
        failedCollectionIds: invalidCollectionIds,
      },
    });
  };

export const doFetchItemsInCollection = (
  options: { collectionId: string, pageSize?: number },
  cb?: () => void
): ThunkAction<Promise<void>> => {
  const { collectionId, pageSize } = options;
  const newOptions: { collectionIds: Array<string>, pageSize?: number } = {
    collectionIds: [collectionId],
  };
  if (pageSize) newOptions.pageSize = pageSize;
  return doFetchItemsInCollections(newOptions, cb);
};

export const doCollectionEdit =
  (
    collectionId: string,
    params: CollectionEditParams
  ): ThunkAction<Promise<boolean | { type: string, data: { message: string } }>> =>
  async (dispatch: Dispatch, getState: GetState) => {
    const state = getState();
    const collection: Collection | void = makeSelectCollectionForId(collectionId)(state);

    if (!collection)
      return dispatch({ type: ACTIONS.COLLECTION_ERROR, data: { message: 'collection does not exist' } });

    const editedCollection: Collection | void = makeSelectEditedCollectionForId(collectionId)(state);
    const unpublishedCollection: Collection | void = makeSelectUnpublishedCollectionForId(collectionId)(state);
    const publishedCollection: Collection | void = makeSelectPublishedCollectionForId(collectionId)(state); // needs to be published only

    const { uris, order, remove, type } = params;

    const collectionType = type || collection.type;
    const currentUrls = collection.items ? collection.items.concat() : [];
    let newItems = currentUrls;

    // Passed uris to add/remove:
    if (uris) {
      if (remove) {
        // Filters (removes) the passed uris from the current list items
        newItems = currentUrls.filter((url) => url && !uris.includes(url));
      } else {
        // Pushes (adds to the end) the passed uris to the current list items
        uris.forEach((url) => newItems.push(url));
      }
    }

    // Passed an ordering to change: (doesn't need the uris here since
    // the items are already on the list)
    if (order) {
      const [movedItem] = currentUrls.splice(order.from, 1);
      currentUrls.splice(order.to, 0, movedItem);
    }

    // Delete 'edited' if newItems are the same as publishedItems
    if (
      editedCollection &&
      publishedCollection &&
      newItems &&
      publishedCollection.items.join(',') === newItems.join(',')
    ) {
      dispatch({ type: ACTIONS.COLLECTION_DELETE, data: { id: collectionId, collectionKey: 'edited' } });
    } else {
      dispatch({
        type: ACTIONS.COLLECTION_EDIT,
        data: {
          id: collectionId,
          collectionKey:
            ((editedCollection || publishedCollection) && 'edited') ||
            (COLS.BUILTIN_LISTS.includes(collectionId) && 'builtin') ||
            (unpublishedCollection && 'unpublished'),
          collection: {
            items: newItems,
            id: collectionId,
            name: params.name || collection.name,
            updatedAt: getTimestamp(),
            type: collectionType,
          },
        },
      });
    }

    return true;
  };
