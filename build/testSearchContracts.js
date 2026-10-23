/* eslint no-console:0 */
const assert = require('assert').strict;
const { load } = require('./testStartup');

const plain = (value) => JSON.parse(JSON.stringify(value));
const constants = load('constants/search.js', {});
const actionTypes = load('constants/action_types.js', {});
const uri = load('util/lbryURI.js', {}, { URLSearchParams });
const config = {
  URL: 'https://lbry.tv',
  URL_LOCAL: 'http://localhost:1337',
  URL_DEV: 'https://dev.lbry.tv',
  LIGHTHOUSE_DEFAULT_TYPES: 'video,audio,text,image,application',
  SEARCH_SERVER_API: 'https://search.example/',
};
const queries = load('util/query-params.js', { 'constants/search': constants });
const search = load('util/search.js', { 'util/lbryURI': uri, config, 'constants/search': constants });
const { parseQueryParams, updateQueryParam, getSearchQueryString } = queries;
const { createNormalizedSearchKey, getRecommendationSearchOptions, getUriForSearchTerm } = search;
assert.deepEqual(plain(parseQueryParams('')), {});
assert.deepEqual(plain(parseQueryParams('/route?discard=1?name=caf%C3%A9&name=last&empty=&equals=a=b')), {
  name: 'last',
  empty: '',
  equals: 'a',
});
assert.equal(parseQueryParams('?flag').flag, undefined);
assert(Object.hasOwn(parseQueryParams('?flag'), 'flag'), 'A bare query key is retained');
assert.equal(updateQueryParam('/route', 'q', 'cats'), '/route?q=cats');
assert.equal(updateQueryParam('/route?q=old&from=2', 'q', 'cats'), '/route?q=cats&from=2');
assert.equal(updateQueryParam('/route?q=cats', 'from', '20'), '/route?q=cats&from=20');
assert.equal(getSearchQueryString('café / cats'), 's=caf%C3%A9%20%2F%20cats&size=20&from=0');
assert.equal(getSearchQueryString('cats', { exact: true, size: 0, from: 0 }), 's="cats"&size=20&from=0');
const options = Object.freeze({
  size: 5,
  from: 20,
  isBackgroundSearch: false,
  claimType: 'file',
  video: true,
  audio: true,
  image: false,
  text: true,
  application: true,
  sort_by: 'release_time',
  time_filter: 'today',
  related_to: 'abc',
  free_only: true,
  nsfw: false,
});
assert.equal(
  getSearchQueryString('cats', options),
  's=cats&size=5&from=20&claimType=file&mediaType=audio,video,text,application,&sort_by=release_time&time_filter=today&related_to=abc&free_only=true&nsfw=false'
);
for (const claimType of ['channel', 'file,channel']) {
  const query = new URLSearchParams(getSearchQueryString('cats', { ...options, claimType }));
  assert.equal(query.get('claimType'), claimType);
  assert(!query.has('mediaType'), 'Channel searches must omit media filters');
}
for (const isBackgroundSearch of [undefined, true]) {
  const query = new URLSearchParams(getSearchQueryString('cats', { ...options, isBackgroundSearch }));
  for (const name of ['claimType', 'mediaType', 'sort_by', 'time_filter']) assert(!query.has(name));
  assert.equal(query.get('nsfw'), 'false');
  assert.equal(query.get('free_only'), 'true');
}
assert(!new URLSearchParams(getSearchQueryString('cats', { nsfw: true, free_only: false })).has('nsfw'));
for (const query of ['s=cats&from=20&size=5', 's=cats&size=5&from=20', 's=cats&size=5']) {
  assert.equal(createNormalizedSearchKey(query), 's=cats&size=5');
}
for (const matureEnabled of [false, true]) {
  for (const claimIsMature of [false, true]) {
    const result = getRecommendationSearchOptions(matureEnabled, claimIsMature, 'abc');
    assert.equal(result.nsfw, matureEnabled);
    assert.equal(result.related_to, matureEnabled || !claimIsMature ? 'abc' : undefined);
  }
}
for (const [term, expected] of [
  ['cats', ['lbry://cats', null]],
  ['@channel', ['@channel', null]],
  ['lbry://cats:abc', ['lbry://cats#abc', null]],
  ['https://odysee.com/@channel:abc/video:def', ['lbry://@channel#abc/video#def', null]],
  ['https://lbry.tv/video:abc', ['lbry://video#abc', null]],
  ['https://odysee.com/@', ['@', 'error']],
])
  assert.deepEqual(plain(getUriForSearchTerm(term)), expected);

const reducer = load('redux/reducers/search.js', {
  'constants/action_types': actionTypes,
  'constants/search': constants,
  'util/search': search,
  'util/redux-utils': load('util/redux-utils.js', {}),
  config,
}).default;
const claims = {
  selectClaimsByUri: (state) => state.claims,
  makeSelectClaimForUri: (uri) => (state) => state.claims[uri],
  makeSelectClaimForClaimId: (id) => (state) => Object.values(state.claims).find((claim) => claim.claim_id === id),
  selectClaimIsNsfwForUri: (state, uri) => Boolean(state.claims[uri]?.mature),
  makeSelectPendingClaimForUri: () => () => undefined,
  selectIsUriResolving: () => false,
};
const settings = { selectShowMatureContent: (state) => Boolean(state.mature) };
const selectors = load('redux/selectors/search.js', {
  'util/query-params': queries,
  'redux/selectors/settings': settings,
  'constants/search': constants,
  'redux/selectors/claims': claims,
  'util/lbryURI': uri,
  'util/claim': { isClaimNsfw: (claim) => Boolean(claim.mature) },
  reselect: require('reselect'),
  're-reselect': require('re-reselect'),
  'util/search': search,
  'redux/selectors/blocked': { selectMutedChannels: (state) => state.blocked || [] },
  'redux/selectors/content': { selectHistory: (state) => state.history || [] },
  lbryinc: { selectAllCostInfoByUri: (state) => state.costs || {} },
});
let state = { search: reducer(undefined, { type: 'INIT' }), claims: {} };
const first = 's=cats&size=2&from=0',
  next = 's=cats&size=2&from=2';
assert.equal(selectors.selectSearchValue(state), undefined);
assert.equal(selectors.makeSelectSearchUrisForQuery(first)(state), undefined);
assert.equal(selectors.makeSelectSearchUrisForQuery('')(state), undefined);
const success = (query, from, uris, size = 2, recsys = null) => ({
  type: actionTypes.SEARCH_SUCCESS,
  data: { query, from, size, uris, recsys },
});
const initial = state.search;
state.search = reducer(initial, success(first, 0, ['lbry://a#a', 'lbry://b#b']));
assert.deepEqual(plain(initial.resultsByQuery), {}, 'Search results must not mutate previous state');
assert.equal(selectors.makeSelectHasReachedMaxResultsLength(first)(state), false);
state.search = reducer(state.search, success(next, 2, ['lbry://b#b', 'lbry://c#c']));
assert.deepEqual(plain(selectors.makeSelectSearchUrisForQuery(next)(state)), [
  'lbry://a#a',
  'lbry://b#b',
  'lbry://c#c',
]);
state.search = reducer(state.search, success(next, 2, []));
assert.equal(selectors.makeSelectHasReachedMaxResultsLength(first)(state), true);
state.search = reducer(state.search, success(first, 0, ['lbry://fresh#f']));
assert.deepEqual(plain(selectors.makeSelectSearchUrisForQuery(first)(state)), ['lbry://fresh#f']);
for (const size of [0, undefined]) {
  const action = success(first, 0, []);
  action.data.size = size;
  const result = reducer(state.search, action);
  assert.equal(result.hasReachedMaxResultsLength['s=cats&size=2'], size);
}
assert.equal(reducer(state.search, { type: 'OTHER' }), state.search, 'Unknown actions retain state identity');
state.search = reducer(state.search, {
  type: actionTypes.SET_MENTION_SEARCH_RESULTS,
  data: { query: '@cat', uris: ['lbry://@cat#a'] },
});
assert.equal(selectors.selectMentionQuery(state), '@cat');
assert.deepEqual(plain(selectors.selectMentionSearchResults(state)), ['lbry://@cat#a']);

const sourceUri = 'lbry://source#abc';
const recommendationQuery = getSearchQueryString('Source', getRecommendationSearchOptions(false, false, 'abc'));
const recommendationState = {
  history: [],
  blocked: [],
  costs: {},
  claims: { [sourceUri]: { claim_id: 'abc', value: { title: 'Source' } } },
  search: reducer(undefined, success(recommendationQuery, 0, [], 20, null)),
};
assert.equal(selectors.makeSelectRecommendedRecsysIdForClaimId('abc')(recommendationState), null);
assert.deepEqual(plain(selectors.selectRecommendedContentForUri(recommendationState, sourceUri)), []);
assert.equal(selectors.selectRecommendedContentForUri(recommendationState, 'lbry://missing'), undefined);
const uncached = { ...recommendationState, search: reducer(undefined, { type: 'INIT' }) };
assert.equal(
  selectors.makeSelectRecommendedRecsysIdForClaimId('abc')(uncached),
  createNormalizedSearchKey(recommendationQuery)
);

async function requests() {
  const requests = [],
    dispatched = [];
  let response = {
    body: [
      { name: '@cat', claimId: 'abc' },
      { name: 'video', claimId: 'def' },
      { name: 'bad', claimId: 'zz' },
    ],
    poweredBy: null,
  };
  let failure = false;
  const actions = load(
    'redux/actions/search.js',
    {
      'constants/action_types': actionTypes,
      'redux/selectors/settings': settings,
      'redux/selectors/claims': {
        ...claims,
        selectClaimForUri: (state, uri) => state.claims[uri],
        makeSelectClaimIsNsfw: () => () => false,
      },
      'redux/actions/claims': { doResolveUris: (uris) => ({ type: 'RESOLVE', uris }) },
      'util/lbryURI': uri,
      'util/batch-actions': { batchActions: (...actions) => ({ type: 'BATCH', actions }) },
      'redux/selectors/search': selectors,
      'util/handle-fetch': load('util/handle-fetch.js', {}),
      'util/query-params': queries,
      'util/search': search,
      config,
    },
    {
      fetch: async (url) => {
        requests.push(url);
        return {
          status: failure ? 503 : 200,
          statusText: 'Unavailable',
          headers: { get: () => response.poweredBy },
          json: async () => response.body,
        };
      },
    }
  );
  const dispatch = (action) => dispatched.push(action);
  const getState = () => state;
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  actions.setSearchApi('https://fixture.example///');
  actions.doSearch('lbry://@cat/video', { size: 2, from: 0 })(dispatch, getState);
  await settle();
  assert.equal(requests[0], 'https://fixture.example/?s=%40cat%20video&size=2&from=0');
  assert.equal(dispatched[0].type, actionTypes.SEARCH_START);
  const batch = dispatched.at(-1).actions;
  assert.equal(batch[0].type, 'RESOLVE');
  assert.deepEqual(plain(batch[0].uris), ['lbry://@cat#abc', 'lbry://video#def']);
  assert.equal(batch[1].data.recsys, null, 'A missing response header remains null');
  actions.doSearch('', {})(dispatch, getState);
  assert.equal(dispatched.at(-1).type, actionTypes.SEARCH_FAIL);
  const before = requests.length;
  actions.doSearch('cats', { size: 2, from: 0 })(dispatch, getState);
  await settle();
  assert.equal(requests.length, before, 'A cached first page must not fetch again');
  failure = true;
  actions.doSearch('uncached', {})(dispatch, getState);
  await settle();
  assert.equal(dispatched.at(-1).type, actionTypes.SEARCH_FAIL);
  actions.doUpdateSearchOptions({ video: false }, {})(dispatch, getState);
  assert.equal(dispatched.at(-1).type, actionTypes.UPDATE_SEARCH_OPTIONS, 'No query means no automatic search');
  state.search = { ...state.search, searchQuery: 'legacy' };
  actions.doUpdateSearchOptions({ video: true }, {})(dispatch, getState);
  assert.equal(typeof dispatched.at(-1), 'function', 'Retain the legacy saved-query behavior');
  console.log(
    'PASS search encoding/filters, LBRY links, recommendation options, pagination/cache, response headers and failed requests'
  );
}
requests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function customSelections() {
  let results;
  let value;
  const selected = [];
  const dependencies = {
    config: { ...config, KNOWN_APP_DOMAINS: [] },
    react: { useRef: () => ({}), useState: (initial) => [initial, () => {}], useEffect: () => {} },
    classnames: require('classnames'),
    'util/lbryURI': uri,
    'effects/use-lighthouse': () => ({ results, loading: false }),
    'component/common/desktop-router': {
      useDesktopHistory: () => ({ push: () => {}, location: { search: '?q=' + encodeURIComponent(value) } }),
    },
    'util/url': {},
    'constants/search': constants,
  };
  for (const name of [
    'constants/pages',
    'constants/icons',
    'component/common/icon',
    'component/common/search-combobox',
    'component/common/form',
    'component/wunderbarTopSuggestion',
    'component/wunderbarSuggestion',
    'component/yrbl',
    'component/spinner',
  ])
    dependencies[name] = {};
  const View = load('component/wunderbarSuggestions/view.jsx', dependencies, { URLSearchParams }).default;
  for (const [input, suggestions, expected] of [
    ['lbry://@cat#a', ['lbry://@cat#abcdef'], 'lbry://@cat#abcdef'],
    ['unmatched', ['lbry://@cat#abcdef'], ''],
    ['empty', [], ''],
    ['loading', null, ''],
    ['initial', undefined, ''],
  ]) {
    value = input;
    results = suggestions;
    const tree = View({
      customSelectAction: (uri) => selected.push(uri),
      doCloseMobileSearch: () => {},
      showMature: false,
    });
    tree.props.children[0].props.onSubmit();
    assert.equal(selected.at(-1), expected);
  }
  console.log('PASS custom search selection preserves full claim IDs and returns an empty string for absent matches');
}
customSelections();
