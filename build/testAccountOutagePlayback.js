/* eslint no-console:0 */
const assert = require('assert').strict;
const { load } = require('./testStartup');
const settings = load('constants/settings.js', {});
const events = [];
let state;
let rateCalls = 0;
const actions = load('redux/actions/content.js', {
  'constants/action_types': {},
  'constants/modal_types': {},
  'util/desktop': {},
  'util/download-notifications': {},
  'redux/actions/app': { doOpenModal: () => ({ type: 'confirm' }) },
  'redux/selectors/claims': {
    makeSelectClaimIsMine: () => () => false,
    makeSelectClaimWasPurchased: () => () => false,
    selectClaimForUri: () => state.claim,
  },
  'redux/selectors/file_info': {
    makeSelectFileInfoForUri: () => () => state.file,
    makeSelectUriIsStreamable: () => () => true,
    selectDownloadingByOutpoint: () => ({}),
  },
  'redux/selectors/collections': {},
  'redux/actions/notifications': { doToast: (data) => ({ type: 'toast', data }) },
  'redux/actions/file': { doPurchaseUri: (uri, cost) => ({ type: 'get', cost }) },
  lbry: {},
  'constants/settings': settings,
  lbryinc: {
    selectCostInfoForUri: () => state.cost,
    Lbryio: {
      getExchangeRates: async () => {
        rateCalls++;
        throw Error('service unavailable');
      },
    },
  },
  'redux/selectors/settings': {
    selectDaemonSettings: () => ({ save_files: false }),
    makeSelectClientSetting: (key) => () =>
      key === settings.INSTANT_PURCHASE_ENABLED ? true : { currency: 'USD', amount: 2 },
  },
});
const dispatch = (action) => (typeof action === 'function' ? action(dispatch, () => state) : events.push(action));
async function main() {
  state = { claim: { value_type: 'stream', value: {} }, cost: { cost: 0 } };
  dispatch(actions.doPlayUri('lbry://free'));
  assert.equal(events.at(-1).type, 'get');
  assert.equal(rateCalls, 0, 'Free playback must not depend on account prices');
  state = { claim: { value_type: 'stream', value: { fee: { currency: 'USD', amount: 1 } } } };
  for (const cost of [undefined, { cost: NaN }, { cost: 0 }]) {
    state.cost = cost;
    events.length = 0;
    dispatch(actions.doPlayUri('lbry://paid'));
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'toast', 'An unknown price must not authorize a purchase');
  }
  state.cost = { cost: 1 };
  events.length = 0;
  dispatch(actions.doPlayUri('lbry://paid'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'toast', 'An unavailable conversion must not bypass an automatic-purchase limit');
  state.file = { completed: true, outpoint: 'fixture:0' };
  state.cost = undefined;
  events.length = 0;
  const before = rateCalls;
  dispatch(actions.doPlayUri('lbry://downloaded'));
  assert.equal(events[0].type, 'get');
  assert.equal(rateCalls, before, 'Existing downloads must remain playable without an exchange rate');
  console.log('PASS account outage: free/local playback and safe handling of unavailable purchase prices');
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
