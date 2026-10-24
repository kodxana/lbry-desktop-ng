// @flow
type CostInfo = { cost: number, ... };
type CostState = { byUri?: { [string]: CostInfo }, fetching?: { [string]: boolean }, ... };
type State = { costInfo?: CostState, ... };

export const selectState = (state: State): CostState => state.costInfo || {};
export const selectAllCostInfoByUri = (state: State): CostState['byUri'] => selectState(state).byUri;
export const selectFetchingCostInfo = (state: State): CostState['fetching'] => selectState(state).fetching;

export const selectCostInfoForUri = (state: State, uri: string): CostInfo | void => {
  const costInfos = selectAllCostInfoByUri(state);
  return costInfos && costInfos[uri];
};

export const selectFetchingCostInfoForUri = (state: State, uri: string): boolean | void => {
  const fetchingByUri = selectFetchingCostInfo(state);
  return fetchingByUri && fetchingByUri[uri];
};
