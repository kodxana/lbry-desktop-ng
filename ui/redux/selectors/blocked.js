// @flow
import { createSelector } from 'reselect';
import { splitBySeparator } from 'util/lbryURI';

type State = { blocked?: BlocklistState, comments?: { moderationBlockList?: Array<string>, ... }, ... };
const EMPTY_BLOCKED: BlocklistState = { blockedChannels: [] };
const selectState = (state: State): BlocklistState => state.blocked || EMPTY_BLOCKED;

export const selectMutedChannels: (State) => Array<string> = createSelector(selectState, (state: BlocklistState) => {
  return state.blockedChannels.filter((e) => typeof e === 'string');
});

export const makeSelectChannelIsMuted = (uri: string): ((State) => boolean) =>
  createSelector(selectMutedChannels, (state: Array<string>) => {
    return state.includes(uri);
  });

export const selectMutedAndBlockedChannelIds: (State) => Array<string> = createSelector(
  selectState,
  (state) => state.comments?.moderationBlockList,
  (state, blockedUris) => {
    const mutedUris = state.blockedChannels;
    const ids: Set<string> = new Set();
    for (const uri of (mutedUris || []).concat(blockedUris || [])) {
      const id = splitBySeparator(uri)[1];
      if (id) ids.add(id);
    }
    return Array.from(ids).sort();
  }
);
