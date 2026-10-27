import * as ACTIONS from 'constants/action_types';
import { Lbryio } from 'lbryinc';
import { selectClaimForUri } from 'redux/selectors/claims';

// eslint-disable-next-line import/prefer-default-export
export function doFetchCostInfoForUri(uri) {
  return (dispatch, getState) => {
    const state = getState();
    const claim = selectClaimForUri(state, uri);

    if (!claim) return;

    function resolve(costInfo) {
      dispatch({
        type: ACTIONS.FETCH_COST_INFO_COMPLETED,
        data: {
          uri,
          costInfo,
        },
      });
    }

    const fee = claim.value ? claim.value.fee : undefined;

    if (fee === undefined) {
      resolve({ cost: 0, includesData: true });
    } else if (fee.currency === 'LBC') {
      resolve({ cost: fee.amount, includesData: true });
    } else {
      // Leave the price unknown on failure; never turn a paid claim into a free one.
      Lbryio.getExchangeRates()
        .then(({ LBC_USD }) => {
          if (Number.isFinite(LBC_USD) && LBC_USD > 0) resolve({ cost: fee.amount / LBC_USD, includesData: true });
        })
        .catch(() => {});
    }
  };
}
