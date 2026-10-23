/* eslint no-console:0 */
const assert = require('assert').strict;
const { load } = require('./testStartup');

let language = 'en';
const globals = { localStorage: { getItem: () => language } };
const intl = load('util/intlNumberFormat.js', {});
const number = load('util/number.js', { './intlNumberFormat': intl }, globals);
const credits = load('util/format-credits.js', { './intlNumberFormat': intl }, globals);
const { formatBytes } = load('util/format-bytes.js', {});
const { toCapitalCase, toCompactNotation } = load('util/string.js', {});
const { secondsToHms, hmsToSeconds } = load('util/time.js', {});

const formatter = intl.getFormatter('en', { maximumFractionDigits: 8 });
assert.equal(intl.getFormatter('en', { maximumFractionDigits: 8 }), formatter, 'Identical options reuse the formatter');
assert.notEqual(intl.getFormatter('de', { maximumFractionDigits: 8 }), formatter);
assert.notEqual(intl.getFormatter('en', { maximumFractionDigits: 2 }), formatter);
assert.equal(formatter.format(0.00000001), '0.00000001');
assert.equal(intl.getFormatter().format(1), '1');
assert.equal(number.formatNumber(1234.567, 2), '1,234.57');
assert.equal(number.formatNumber(0.00000001, 8), '0.00000001');
assert.equal(number.formatNumber(1200000, 1, true), '1.2M');
assert.equal(number.formatNumberWithCommas(1), '1.00000000');
assert.equal(number.formatNumberWithCommas(1234.5, 2), '1,234.50');
for (const value of [0, -1, 0.00000001, Infinity]) assert(number.isTrulyANumber(value));
for (const value of [NaN, '1', null, undefined, {}, true]) assert(!number.isTrulyANumber(value));

for (const value of [0, '0', null, undefined, NaN, 'invalid']) assert.equal(credits.formatCredits(value), '0');
assert.equal(credits.formatCredits('1.234', 2), '1.25');
assert.equal(credits.formatCredits('-1.234', 2), '-1.25');
assert.equal(credits.formatCredits('1000000', 2, true), '1.00M');
assert.equal(credits.formatCredits('0.00000001', 8), '0.00000000', 'Keep the existing five-unit display rounding');
for (const value of [1, '1']) assert.equal(credits.creditsToString(value), '1.00000000');
assert.equal(
  credits.creditsToString('0.00000001'),
  '0.00000001',
  'A one-unit transaction amount is not display-rounded'
);
assert.equal(credits.creditsToString('1.123456789'), '1.12345679');
assert.equal(credits.creditsToString('-0.00000001'), '-0.00000001');
assert.equal(credits.formatFullPrice('0.000123456', 2), 0.00012);
assert.equal(credits.formatFullPrice(12.345, 2), 12.34);
assert.equal(credits.formatFullPrice('5.000', 2), 5);
language = 'de';
assert.equal(number.formatNumber(1234.5, 2), '1.234,5');
assert.equal(credits.formatCredits('1234.5', 2), '1.234,50');
language = 'en';
assert.equal(number.formatNumber(1234.5, 2), '1,234.5', 'Switching language must not reuse another locale');

assert.equal(formatBytes(0), '0 Bytes');
assert.equal(formatBytes(1024), '1 KB');
assert.equal(formatBytes(1536), '1.5 KB');
assert.equal(formatBytes(1536, -1), '2 KB');
assert.equal(toCapitalCase('wallet'), 'Wallet');
assert.equal(toCapitalCase(''), '');
assert.equal(toCompactNotation('1200', 'en'), '1,200');
assert.equal(toCompactNotation(1200, 'en', 1000), '1.2K');
assert.equal(toCompactNotation(1200, null, 2000), '1,200');
for (const [input, text] of [
  [0, '00:00'],
  [59.9, '00:59'],
  [60, '01:00'],
  [3600, '01:00:00'],
  [3661, '01:01:01'],
]) {
  assert.equal(secondsToHms(input), text);
  assert.equal(hmsToSeconds(text), Math.floor(input));
}
assert.equal(hmsToSeconds(''), 0);
assert.equal(hmsToSeconds('bad:02'), 2);
assert.equal(hmsToSeconds('1:2:3'), 3723);
console.log(
  'PASS formatter caches/locales, tiny credit display and transaction values, byte sizes and time conversion'
);

async function collectionBids() {
  const requests = [];
  const actions = load('constants/action_types.js', {});
  const { doCollectionPublishUpdate } = load('redux/actions/claims.js', {
    'constants/action_types': actions,
    'constants/abandon_states': {},
    lbry: {
      collection_update: async (params) => {
        requests.push(JSON.parse(JSON.stringify(params)));
        return { outputs: [{ claim_id: params.claim_id }] };
      },
    },
    'util/lbryURI': {},
    'redux/actions/notifications': {},
    'redux/selectors/claims': {},
    'redux/actions/wallet': {},
    'redux/selectors/wallet': {},
    'util/format-credits': credits,
    'util/batch-actions': {},
    'util/claim': {},
    'constants/claim': {},
    'redux/selectors/collections': { makeSelectClaimIdsForCollectionId: () => () => ['fixture-item'] },
    'redux/actions/collections': {},
  });
  const dispatches = [];
  const dispatch = (action) => {
    if (typeof action !== 'function') dispatches.push(action);
  };
  const getState = () => ({});
  for (const bid of [undefined, '0', '0.00000001', '1.23456789']) {
    const options = Object.freeze({
      claim_id: 'fixture-collection',
      title: 'Fixture',
      ...(bid === undefined ? {} : { bid }),
    });
    await doCollectionPublishUpdate(options)(dispatch, getState);
    const request = requests.at(-1);
    assert.equal(request.claim_id, options.claim_id);
    assert.equal(request.title, options.title);
    assert.equal(request.replace, true);
    if (bid === undefined) assert(!Object.hasOwn(request, 'bid'), 'An omitted bid must stay absent, not become NaN');
    else assert.equal(request.bid, credits.creditsToString(bid), 'Explicit bids retain eight-decimal serialization');
  }
  await doCollectionPublishUpdate({ claim_id: 'fixture-collection' }, true)(dispatch, getState);
  assert.deepEqual(requests.at(-1), {
    blocking: true,
    claim_id: 'fixture-collection',
    clear_claims: true,
    claims: ['fixture-item'],
  });
  assert.equal(dispatches.filter((action) => action.type === actions.COLLECTION_PUBLISH_UPDATE_COMPLETED).length, 5);
  console.log('PASS collection update payloads preserve omitted, zero and tiny bids and background claim lists');
}
collectionBids().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
