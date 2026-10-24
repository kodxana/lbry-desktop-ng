// @flow
import { createSelector } from 'reselect';
import { createCachedSelector } from 're-reselect';
import { selectMutedChannels } from 'redux/selectors/blocked';
import { selectShowMatureContent } from 'redux/selectors/settings';
import { selectMentionSearchResults, selectMentionQuery } from 'redux/selectors/search';
import { selectBlacklistedOutpointMap, selectFilteredOutpointMap } from 'lbryinc';
import {
  selectClaimsById,
  selectMyClaimIdsRaw,
  selectMyChannelClaimIds,
  selectClaimIdForUri,
  selectClaimIdsByUri,
} from 'redux/selectors/claims';
import { isClaimNsfw, getChannelFromClaim } from 'util/claim';
import { selectSubscriptionUris } from 'redux/selectors/subscriptions';

type State = { claims: any, comments: CommentsState };
type CommentSelector<T> = (state: State) => T;
type CommentLists = { [string]: Array<LbryComment> };
type CommentFilterInputs = [
  { [string]: Claim },
  ?Array<string>,
  ?Array<string>,
  Array<string>,
  Array<string>,
  { [string]: boolean },
  { [string]: boolean },
  boolean,
];
type MentionData = {
  canonicalCommentors: Array<string>,
  canonicalCreatorUri: string | void,
  canonicalSearch: Array<string>,
  canonicalSubscriptions: Array<string>,
  commentorUris: Array<string>,
  hasNewResolvedResults: boolean,
  query: string,
};

const selectState = (state: State): CommentsState => state.comments;

export const selectCommentsById = (state: State): CommentsState['commentById'] => selectState(state).commentById || {};
export const selectCommentIdsByClaimId = (state: State): CommentsState['byId'] => selectState(state).byId;
export const selectIsFetchingComments = (state: State): CommentsState['isLoading'] => selectState(state).isLoading;
export const selectIsFetchingCommentsById = (state: State): CommentsState['isLoadingById'] =>
  selectState(state).isLoadingById;
export const selectIsFetchingCommentsByParentId = (state: State): CommentsState['isLoadingByParentId'] =>
  selectState(state).isLoadingByParentId;
export const selectIsFetchingReacts = (state: State): CommentsState['isFetchingReacts'] =>
  selectState(state).isFetchingReacts;

export const selectMyReacts = (state: State): CommentsState['myReactsByCommentId'] =>
  state.comments.myReactsByCommentId;
export const selectMyReactsForComment = (state: State, commentIdChannelId: string): ?Array<string> => {
  // @commentIdChannelId: Format = 'commentId:MyChannelId'
  return state.comments.myReactsByCommentId && state.comments.myReactsByCommentId[commentIdChannelId];
};

export const selectOthersReacts = (state: State): CommentsState['othersReactsByCommentId'] =>
  state.comments.othersReactsByCommentId;
export const selectOthersReactsForComment = (state: State, id: string): ?{ [string]: number } => {
  return state.comments.othersReactsByCommentId && state.comments.othersReactsByCommentId[id];
};

export const selectCommentsByUri: CommentSelector<CommentsState['commentsByUri']> = createSelector(
  selectState,
  (state) => ({ ...state.commentsByUri })
);

export const selectPinnedCommentsById = (state: State): CommentsState['pinnedCommentsById'] =>
  selectState(state).pinnedCommentsById;
export const selectPinnedCommentsForUri: (state: State, uri: string) => Array<LbryComment> = createCachedSelector(
  selectClaimIdForUri,
  selectCommentsById,
  selectPinnedCommentsById,
  (state, uri) => uri,
  (claimId: ?string, byId: CommentsState['commentById'], pinnedCommentsById: CommentsState['pinnedCommentsById']) => {
    const pinnedCommentIds = claimId && pinnedCommentsById[claimId];
    const pinnedComments: Array<LbryComment> = [];

    if (pinnedCommentIds) {
      pinnedCommentIds.forEach((commentId) => {
        const comment = byId[commentId];
        if (comment) pinnedComments.push(comment);
      });
    }

    return pinnedComments;
  }
)((state, uri) => String(uri));

export const selectModerationBlockList: CommentSelector<Array<string>> = createSelector(
  (state: State) => selectState(state).moderationBlockList,
  (moderationBlockList) => {
    return moderationBlockList ? moderationBlockList.slice().reverse() : [];
  }
);
export const selectAdminBlockList: CommentSelector<Array<string>> = createSelector(selectState, (state) =>
  state.adminBlockList ? state.adminBlockList.slice().reverse() : []
);
export const selectModeratorBlockList: CommentSelector<Array<string>> = createSelector(selectState, (state) =>
  state.moderatorBlockList ? state.moderatorBlockList.slice().reverse() : []
);

export const selectPersonalTimeoutMap = (state: State): CommentsState['personalTimeoutMap'] =>
  selectState(state).personalTimeoutMap;
export const selectAdminTimeoutMap = (state: State): CommentsState['adminTimeoutMap'] =>
  selectState(state).adminTimeoutMap;
export const selectModeratorTimeoutMap = (state: State): CommentsState['moderatorTimeoutMap'] =>
  selectState(state).moderatorTimeoutMap;
export const selectModeratorBlockListDelegatorsMap = (state: State): CommentsState['moderatorBlockListDelegatorsMap'] =>
  selectState(state).moderatorBlockListDelegatorsMap;
export const selectTogglingForDelegatorMap = (state: State): CommentsState['togglingForDelegatorMap'] =>
  selectState(state).togglingForDelegatorMap;
export const selectBlockingByUri = (state: State): CommentsState['blockingByUri'] => selectState(state).blockingByUri;
export const selectUnBlockingByUri = (state: State): CommentsState['unBlockingByUri'] =>
  selectState(state).unBlockingByUri;
export const selectFetchingModerationBlockList = (state: State): CommentsState['fetchingModerationBlockList'] =>
  selectState(state).fetchingModerationBlockList;
export const selectModerationDelegatesById = (state: State): CommentsState['moderationDelegatesById'] =>
  selectState(state).moderationDelegatesById;
export const selectIsFetchingModerationDelegates = (state: State): CommentsState['fetchingModerationDelegates'] =>
  selectState(state).fetchingModerationDelegates;
export const selectModerationDelegatorsById = (state: State): CommentsState['moderationDelegatorsById'] =>
  selectState(state).moderationDelegatorsById;
export const selectIsFetchingModerationDelegators = (state: State): CommentsState['fetchingModerationDelegators'] =>
  selectState(state).fetchingModerationDelegators;

export const selectHasAdminChannel: CommentSelector<boolean> = createSelector(selectState, (state) => {
  const myChannelIds = Object.keys(state.moderationDelegatorsById);
  for (let i = 0; i < myChannelIds.length; ++i) {
    const id = myChannelIds[i];
    if (state.moderationDelegatorsById[id] && state.moderationDelegatorsById[id].global) {
      return true;
    }
  }
  return false;

  /// Lint doesn't like this:
  // return Object.values(state.moderationDelegatorsById).some((x) => x.global);
});

export const selectCommentsByClaimId: CommentSelector<CommentLists> = createSelector(
  selectState,
  selectCommentsById,
  (state, byId) => {
    const byClaimId = state.byId || {};
    const comments: CommentLists = {};

    // replace every comment_id in the list with the actual comment object
    Object.keys(byClaimId).forEach((claimId: string) => {
      const commentIds = byClaimId[claimId] || [];

      comments[claimId] = commentIds.map((commentId) => byId[commentId]).filter((comment) => Boolean(comment));
    });

    return comments;
  }
);

// no superchats
export const selectSuperchatsByUri = (state: State): CommentsState['superChatsByUri'] =>
  selectState(state).superChatsByUri;

export const selectTopLevelCommentsByClaimId: CommentSelector<CommentLists> = createSelector(
  (state) => selectState(state).topLevelCommentsById,
  selectCommentsById,
  (topLevelCommentsById, byId) => {
    const byClaimId = topLevelCommentsById || {};
    const comments: CommentLists = {};

    // replace every comment_id in the list with the actual comment object
    Object.keys(byClaimId).forEach((claimId) => {
      const commentIds = byClaimId[claimId] || [];

      comments[claimId] = commentIds.map((commentId) => byId[commentId]).filter((comment) => Boolean(comment));
    });

    return comments;
  }
);

export const makeSelectCommentForCommentId = (commentId: string): CommentSelector<LbryComment | void> =>
  createSelector(selectCommentsById, (comments) => comments[commentId]);

export const selectRepliesByParentId: CommentSelector<CommentLists> = createSelector(
  selectState,
  selectCommentsById,
  (state, byId) => {
    const byParentId = state.repliesByParentId || {};
    const comments: CommentLists = {};

    // replace every comment_id in the list with the actual comment object
    Object.keys(byParentId).forEach((id) => {
      const commentIds = byParentId[id] || [];

      comments[id] = commentIds.map((commentId) => byId[commentId]).filter((comment) => Boolean(comment));
    });

    return comments;
  }
);

export const selectLinkedCommentAncestors = (state: State): CommentsState['linkedCommentAncestors'] =>
  selectState(state).linkedCommentAncestors;

export const selectCommentIdsForUri = (state: State, uri: string): Array<string> | void => {
  const claimId = selectClaimIdForUri(state, uri);
  const commentIdsByClaimId = selectCommentIdsByClaimId(state);
  return claimId != null ? commentIdsByClaimId[claimId] : undefined;
};

// deprecated
export const makeSelectCommentIdsForUri = (uri: string): CommentSelector<Array<string> | void> =>
  createSelector(selectState, selectCommentsByUri, selectClaimsById, (state, byUri) => {
    const claimId = byUri[uri];
    return state.byId[claimId];
  });

const filterCommentsDepOnList = {
  claimsById: selectClaimsById,
  myClaimIds: selectMyClaimIdsRaw,
  myChannelClaimIds: selectMyChannelClaimIds,
  mutedChannels: selectMutedChannels,
  personalBlockList: selectModerationBlockList,
  blacklistedMap: selectBlacklistedOutpointMap,
  filteredMap: selectFilteredOutpointMap,
  showMatureContent: selectShowMatureContent,
};

export const selectPendingCommentReacts = (state: State): CommentsState['pendingCommentReactions'] =>
  selectState(state).pendingCommentReactions;
export const selectSettingsByChannelId = (state: State): CommentsState['settingsByChannelId'] =>
  selectState(state).settingsByChannelId;
export const selectFetchingCreatorSettings = (state: State): CommentsState['fetchingSettings'] =>
  selectState(state).fetchingSettings;
export const selectFetchingBlockedWords = (state: State): CommentsState['fetchingBlockedWords'] =>
  selectState(state).fetchingBlockedWords;

export const selectCommentsForUri: (state: State, uri: string) => Array<LbryComment> = createCachedSelector(
  (state, uri) => uri,
  selectCommentsByClaimId,
  selectClaimIdForUri,
  ...Object.values(filterCommentsDepOnList),
  (uri: string, byClaimId: CommentLists, claimId: ?string, ...filterInputs: CommentFilterInputs) => {
    const comments = claimId ? byClaimId[claimId] : undefined;
    return filterComments(comments, claimId, filterInputs);
  }
)((state, uri) => String(uri));

export const selectTopLevelCommentsForUri: (state: State, uri: string, maxCount?: number) => Array<LbryComment> =
  createCachedSelector(
    (state, uri) => uri,
    (state, uri, maxCount) => maxCount,
    selectTopLevelCommentsByClaimId,
    selectClaimIdForUri,
    ...Object.values(filterCommentsDepOnList),
    (
      uri: string,
      maxCount: number = -1,
      byClaimId: CommentLists,
      claimId: ?string,
      ...filterInputs: CommentFilterInputs
    ) => {
      const comments = claimId ? byClaimId[claimId] : undefined;
      if (comments) {
        return filterComments(maxCount > 0 ? comments.slice(0, maxCount) : comments, claimId, filterInputs);
      } else {
        return [];
      }
    }
  )((state, uri, maxCount = -1) => `${String(uri)}:${maxCount}`);

export const makeSelectTopLevelTotalCommentsForUri = (uri: string): CommentSelector<number> =>
  createSelector(selectState, selectCommentsByUri, (state, byUri) => {
    const claimId = byUri[uri];
    return state.topLevelTotalCommentsById[claimId] || 0;
  });

export const makeSelectTopLevelTotalPagesForUri = (uri: string): CommentSelector<number> =>
  createSelector(selectState, selectCommentsByUri, (state, byUri) => {
    const claimId = byUri[uri];
    return state.topLevelTotalPagesById[claimId] || 0;
  });

export const selectRepliesForParentId: (state: State, id: string) => Array<LbryComment> | null = createCachedSelector(
  (state, id) => id,
  (state) => selectState(state).repliesByParentId,
  selectCommentsById,
  ...Object.values(filterCommentsDepOnList),
  (
    id: string,
    repliesByParentId: CommentsState['repliesByParentId'],
    commentsById: CommentsState['commentById'],
    ...filterInputs: CommentFilterInputs
  ) => {
    // const claimId = byUri[uri]; // just parentId (id)
    const replyIdsForParent = repliesByParentId[id] || [];
    if (!replyIdsForParent.length) return null;

    const comments: Array<LbryComment> = [];
    replyIdsForParent.forEach((cid) => {
      const comment = commentsById[cid];
      if (comment) comments.push(comment);
    });
    // const comments = byParentId && byParentId[id];

    return filterComments(comments, undefined, filterInputs);
  }
)((state, id: string) => String(id));

/**
 * filterComments
 *
 * @param comments List of comments to filter.
 * @param claimId The claim that `comments` reside in.
 * @param filterInputs Values returned by filterCommentsDepOnList.
 */
const filterComments = (
  comments: ?Array<LbryComment>,
  claimId: ?string,
  filterInputs: CommentFilterInputs
): Array<LbryComment> => {
  const [
    claimsById,
    myClaimIds,
    myChannelClaimIds,
    mutedChannels,
    personalBlockList,
    blacklistedMap,
    filteredMap,
    showMatureContent,
  ] = filterInputs;

  return comments
    ? comments.filter((comment) => {
        if (!comment) {
          // It may have been recently deleted after being blocked
          return false;
        }

        const channelClaim = claimsById[comment.channel_id];

        // Return comment if `channelClaim` doesn't exist so the component knows to resolve the author
        if (channelClaim) {
          if ((myClaimIds && myClaimIds.length > 0) || (myChannelClaimIds && myChannelClaimIds.length > 0)) {
            const claimIsMine =
              channelClaim.is_my_output ||
              (myChannelClaimIds && myChannelClaimIds.includes(channelClaim.claim_id)) ||
              (myClaimIds && myClaimIds.includes(channelClaim.claim_id));
            // TODO: I believe 'myClaimIds' does not include channels, so it seems wasteful to include it here?   ^
            if (claimIsMine) {
              return true;
            }
          }

          const outpoint = `${channelClaim.txid}:${channelClaim.nout}`;
          if (blacklistedMap[outpoint] || filteredMap[outpoint]) {
            return false;
          }

          if (!showMatureContent) {
            const claimIsMature = isClaimNsfw(channelClaim);
            if (claimIsMature) {
              return false;
            }
          }
        }

        if (claimId) {
          const claimIdIsMine = myClaimIds && myClaimIds.length > 0 && myClaimIds.includes(claimId);
          if (!claimIdIsMine) {
            if (comment.channel_url && personalBlockList.includes(comment.channel_url)) {
              return false;
            }
          }
        }

        return !comment.channel_url || !mutedChannels.includes(comment.channel_url);
      })
    : [];
};

export const makeSelectTotalReplyPagesForParentId = (parentId: string): CommentSelector<number> =>
  createSelector(selectState, (state) => {
    return state.repliesTotalPagesByParentId[parentId] || 0;
  });

export const makeSelectTotalCommentsCountForUri = (uri: string): CommentSelector<number> =>
  createSelector(selectState, selectCommentsByUri, (state, byUri) => {
    const claimId = byUri[uri];
    return state.totalCommentsById[claimId] || 0;
  });

// Personal list
export const makeSelectChannelIsBlocked = (uri: string): CommentSelector<boolean> =>
  createSelector(selectModerationBlockList, (blockedChannelUris) => {
    if (!blockedChannelUris || !blockedChannelUris) {
      return false;
    }

    return blockedChannelUris.includes(uri);
  });

export const makeSelectChannelIsAdminBlocked = (uri: string): CommentSelector<boolean> =>
  createSelector(selectAdminBlockList, (list) => {
    return list ? list.includes(uri) : false;
  });

export const makeSelectChannelIsModeratorBlocked = (uri: string): CommentSelector<boolean> =>
  createSelector(selectModeratorBlockList, (list) => {
    return list ? list.includes(uri) : false;
  });

export const makeSelectChannelIsModeratorBlockedForCreator = (
  uri: string,
  creatorUri: string
): CommentSelector<boolean | void> =>
  createSelector(selectModeratorBlockList, selectModeratorBlockListDelegatorsMap, (blockList, delegatorsMap) => {
    if (!blockList) return false;
    return blockList.includes(uri) && delegatorsMap[uri] && delegatorsMap[uri].includes(creatorUri);
  });

export const makeSelectIsTogglingForDelegator = (uri: string, creatorUri: string): CommentSelector<boolean | void> =>
  createSelector(selectTogglingForDelegatorMap, (togglingForDelegatorMap) => {
    return togglingForDelegatorMap[uri] && togglingForDelegatorMap[uri].includes(creatorUri);
  });

export const makeSelectUriIsBlockingOrUnBlocking = (uri: string): CommentSelector<boolean | void> =>
  createSelector(selectBlockingByUri, selectUnBlockingByUri, (blockingByUri, unBlockingByUri) => {
    return blockingByUri[uri] || unBlockingByUri[uri];
  });

export const selectSuperChatDataForUri = (
  state: State,
  uri: string
): CommentsState['superChatsByUri'][string] | void => {
  const byUri = selectSuperchatsByUri(state);
  return byUri[uri];
};

export const selectSuperChatsForUri = (state: State, uri: string): Array<LbryComment> | void => {
  const superChatData = selectSuperChatDataForUri(state, uri);
  return superChatData ? superChatData.comments : undefined;
};

export const selectSuperChatTotalAmountForUri = (state: State, uri: string): number => {
  const superChatData = selectSuperChatDataForUri(state, uri);
  return superChatData ? superChatData.totalAmount : 0;
};

export const selectChannelMentionData: (state: State, uri: string, maxCount?: number) => MentionData =
  createCachedSelector(
    (state, uri) => uri,
    selectClaimIdsByUri,
    selectClaimsById,
    selectTopLevelCommentsForUri,
    selectSubscriptionUris,
    selectMentionSearchResults,
    selectMentionQuery,
    (
      uri: string,
      claimIdsByUri: { [string]: string },
      claimsById: { [string]: Claim },
      topLevelComments: Array<LbryComment>,
      subscriptionUris: ?Array<string>,
      searchUris: Array<string>,
      query: string
    ) => {
      let canonicalCreatorUri;
      const commentorUris: Array<string> = [];
      const canonicalCommentors: Array<string> = [];
      const canonicalSubscriptions: Array<string> = [];
      const canonicalSearch: Array<string> = [];

      if (uri) {
        const claimId = claimIdsByUri[uri];
        const claim = claimsById[claimId];
        const channelFromClaim = claim && getChannelFromClaim(claim);
        canonicalCreatorUri = channelFromClaim ? channelFromClaim.canonical_url : undefined;

        topLevelComments.forEach(({ channel_url: uri }) => {
          // Check: if there are duplicate commentors
          if (uri && !commentorUris.includes(uri)) {
            // Update: commentorUris
            commentorUris.push(uri);

            // Update: canonicalCommentors
            const claimId = claimIdsByUri[uri];
            const claim = claimsById[claimId];
            if (claim && claim.canonical_url) {
              canonicalCommentors.push(claim.canonical_url);
            }
          }
        });
      }

      (subscriptionUris || []).forEach((uri) => {
        // Update: canonicalSubscriptions
        const claimId = claimIdsByUri[uri];
        const claim = claimsById[claimId];
        if (claim && claim.canonical_url) {
          canonicalSubscriptions.push(claim.canonical_url);
        }
      });

      let hasNewResolvedResults = false;
      if (searchUris && searchUris.length > 0) {
        searchUris.forEach((uri) => {
          // Update: canonicalSubscriptions
          const claimId = claimIdsByUri[uri];
          const claim = claimsById[claimId];
          if (claim && claim.canonical_url) {
            canonicalSearch.push(claim.canonical_url);
          }
        });
        hasNewResolvedResults = canonicalSearch.length > 0;
      }

      return {
        canonicalCommentors,
        canonicalCreatorUri,
        canonicalSearch,
        canonicalSubscriptions,
        commentorUris,
        hasNewResolvedResults,
        query,
      };
    }
  )((state, uri, maxCount) => `${String(uri)}:${maxCount}`);
