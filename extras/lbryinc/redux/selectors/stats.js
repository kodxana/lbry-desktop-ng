// @flow
import { createSelector } from 'reselect';
import { selectClaimIdForUri } from 'redux/selectors/claims';

type Stats = { viewCountById: { [string]: number }, subCountById: { [string]: number }, ... };
type State = { claims: ClaimsState, stats?: Stats, ... };
const EMPTY_STATS: Stats = { viewCountById: {}, subCountById: {} };
const selectState = (state: State): Stats => state.stats || EMPTY_STATS;
export const selectViewCount: (State) => Stats['viewCountById'] = createSelector(
  selectState,
  (state) => state.viewCountById
);
export const selectSubCount: (State) => Stats['subCountById'] = createSelector(
  selectState,
  (state) => state.subCountById
);

export const selectViewCountForUri = (state: State, uri: string): number => {
  const claimId = selectClaimIdForUri(state, uri);
  const viewCountById = selectViewCount(state);
  return claimId ? viewCountById[claimId] || 0 : 0;
};

export const selectSubCountForUri = (state: State, uri: string): number => {
  const claimId = selectClaimIdForUri(state, uri);
  const subCountById = selectSubCount(state);
  return claimId ? subCountById[claimId] || 0 : 0;
};
