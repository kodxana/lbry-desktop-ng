/* eslint no-console:0 */
const assert = require('assert').strict;
const moment = require('moment');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./testStartup');

const plain = (value) => JSON.parse(JSON.stringify(value));
const pages = load('constants/pages.js', {});
const cs = load('constants/claim_search.js', {});
const icons = load('constants/icons.js', {});
const uri = load('util/lbryURI.js', {}, { URLSearchParams });
const fixedTime = '2026-10-21T12:00:00Z';
const date = () => moment(fixedTime);
const dependencies = {
  'constants/pages': pages,
  'constants/icons': icons,
  'constants/claim_search': cs,
  'constants/supported_languages': load('constants/supported_languages.js', {
    './languages': load('constants/languages.js', {}),
  }),
  'util/lbryURI': uri,
  'util/string': load('util/string.js', {}),
  moment: date,
};
function homepage(custom = false, language = 'en') {
  return load(
    'util/buildHomepage.js',
    { ...dependencies, config: { CUSTOM_HOMEPAGE: custom } },
    {
      URLSearchParams,
      localStorage: { getItem: () => language },
    }
  );
}
const { GetLinksData, getHomepageRowForCat, getAllIds } = homepage();
const category = { name: 'science', label: 'Science', channelIds: ['abc', 'def'], pinnedUrls: ['lbry://video#abc'] };
const news = { name: 'news', label: 'News' };
const config = Object.freeze({ SCIENCE: Object.freeze(category), NEWS: Object.freeze(news) });
const before = JSON.stringify(config);
assert.deepEqual(plain(getAllIds({ A: category, B: { ...category, channelIds: ['def', 'ghi'] }, C: news })), [
  'abc',
  'def',
  'ghi',
]);
assert.deepEqual(plain(getAllIds({})), []);
const row = getHomepageRowForCat(category);
assert.equal(row.title, 'Science');
assert.equal(row.route, '/$/science');
assert.equal(row.icon, '');
assert.deepEqual(plain(row.pinnedUrls), category.pinnedUrls);
assert.equal(new URL(row.link, 'https://example.test').searchParams.get(cs.CHANNEL_IDS_KEY), 'abc,def');
assert.equal(row.options.claimType, 'stream');
assert.deepEqual(plain(row.options.orderBy), plain(cs.ORDER_BY_NEW_VALUE));
assert.equal(row.options.releaseTime, '>' + date().subtract(30, 'days').startOf('week').unix());
for (const [order, value] of [
  ['trending', cs.ORDER_BY_TRENDING_VALUE],
  ['top', cs.ORDER_BY_TOP_VALUE],
  ['other', cs.ORDER_BY_NEW_VALUE],
]) {
  assert.deepEqual(plain(getHomepageRowForCat({ ...category, order }).options.orderBy), plain(value));
}
for (const [size, expected] of [
  [1, 3],
  [149, 3],
  [150, 2],
  [249, 2],
  [250, 1],
]) {
  const cat = { ...category, channelIds: Array(size).fill('abc'), channelLimit: 'auto' };
  assert.equal(getHomepageRowForCat(cat).options.limitClaimsPerChannel, expected);
  assert.equal(getHomepageRowForCat({ ...cat, claimType: 'channel' }).options.limitClaimsPerChannel, 1);
}
for (const [channelLimit, expected] of [
  ['2.9', 2],
  ['0', undefined],
  ['', undefined],
  ['invalid', undefined],
]) {
  assert.equal(getHomepageRowForCat({ ...category, channelLimit }).options.limitClaimsPerChannel, expected);
}
assert.equal(
  getHomepageRowForCat({ ...category, channelIds: [], channelLimit: 'auto' }).options.limitClaimsPerChannel,
  undefined
);
assert.equal(getHomepageRowForCat({ ...category, name: '' }).route, undefined);
const customized = getHomepageRowForCat({
  ...category,
  claimType: 'channel',
  pageSize: 12,
  daysOfContent: 7,
  icon: 'science',
});
assert.equal(new URL(customized.link, 'https://example.test').searchParams.get(cs.CLAIM_TYPE), 'channel');
assert.equal(customized.options.pageSize, 12);
assert.equal(customized.options.releaseTime, '>' + date().subtract(7, 'days').startOf('week').unix());
assert.equal(customized.icon, 'science');
const defaults = GetLinksData({}, false);
assert.deepEqual(plain(defaults.map((item) => item.title)), [
  'Top Content from Today',
  'Latest From @lbry',
  'Top Channels On LBRY',
]);
assert.equal(defaults[0].options.pageSize, 8);
assert.equal(GetLinksData({}, true)[0].options.pageSize, 12);
assert.equal(GetLinksData(config, false).at(-1).route, '/$/news');
assert.equal(GetLinksData(config, false, true).at(-1).route, '/$/science');
assert.deepEqual(
  plain(
    homepage(true)
      .GetLinksData(config, false)
      .map((item) => item.route)
  ),
  ['/$/science', '/$/news']
);
assert.deepEqual(plain(homepage(true).GetLinksData({}, false)), []);
const translated = homepage(false, 'pl').GetLinksData({}, false);
assert.equal(translated.length, 4);
assert.deepEqual(plain(translated[1].options.languages), ['pl']);
assert.equal(new URL(translated[1].link, 'https://example.test').searchParams.get(cs.LANGUAGE_KEY), 'pl');
const tags = [{ name: 'science' }, { name: 'music' }];
const grouped = GetLinksData({}, false, true, false, true, [], tags, false);
assert.deepEqual(plain(grouped[0].options.tags), ['science', 'music']);
const individual = GetLinksData({}, false, true, false, true, [], tags, true);
assert.deepEqual(plain(individual.slice(0, 2).map((item) => item.options.tags)), [['science'], ['music']]);
assert(!GetLinksData({}, false, false, false, true, [], tags, true).some((item) => item.options.tags));
assert(!homepage(true).GetLinksData({}, false, true, false, true, [], tags, true).length);
const subscriptions = [
  { channelName: '@first', uri: 'lbry://@first#abc' },
  { channelName: '@second', uri: 'lbry://@second:def' },
];
for (const [count, size, months] of [
  [2, 4, 12],
  [4, 8, 12],
  [7, 16, 12],
  [21, 16, 9],
]) {
  const subs = Array.from({ length: count }, (_, index) => subscriptions[index % 2]);
  const following = GetLinksData({}, false, true, true, false, subs)[0];
  assert.equal(following.title, 'Recent From Following');
  assert.equal(following.options.pageSize, size);
  assert.equal(following.options.releaseTime, '>' + date().subtract(months, 'months').startOf('week').unix());
}
const stale = [
  { channelName: '@missing', uri: 'lbry://@missing' },
  { channelName: '@bad', uri: 'lbry://@' },
];
const mixed = GetLinksData({}, false, true, true, false, [...stale, ...subscriptions]);
assert.deepEqual(plain(mixed[0].options.channelIds), ['abc', 'def']);
for (const subs of [[], stale]) {
  assert(
    !GetLinksData({}, false, true, true, false, subs).some((item) => item.title === 'Recent From Following'),
    'Missing channel IDs must not turn Following into an unrestricted query'
  );
}
assert.equal(JSON.stringify(config), before, 'Building routes and feeds must not mutate category configuration');

const tiles = [];
const Home = load('page/home/view.jsx', {
  react: React,
  'constants/icons': icons,
  'constants/pages': pages,
  config: { SITE_NAME: 'LBRY Desktop NG' },
  'component/page': ({ children }) => React.createElement('main', null, children),
  'component/button': ({ label, children, navigate }) => React.createElement('a', { href: navigate }, label, children),
  'component/claimTilesDiscover': (props) => {
    tiles.push(props);
    return null;
  },
  'component/claimPreviewTile': () => null,
  'component/common/icon': () => null,
  'component/common/wait-until-on-page': ({ children }) => children,
  'effects/use-screensize': { useIsLargeScreen: () => false },
  'util/buildHomepage': homepage(true),
}).default;
const html = renderToStaticMarkup(
  React.createElement(Home, {
    homepageData: { SCIENCE: category },
    followedTags: [],
    subscribedChannels: [],
    showNsfw: false,
  })
);
assert(html.includes('Find new channels to follow'));
assert(html.includes('href="/$/science"'));
assert.equal(tiles.length, 1);
assert.deepEqual(plain(tiles[0].channelIds), ['abc', 'def']);
assert.deepEqual(plain(tiles[0].pinUrls), category.pinnedUrls);
assert.equal(tiles[0].hasSource, true);
console.log(
  'PASS homepage categories, routes, localized and personalized feeds, stale subscriptions and home rendering'
);
