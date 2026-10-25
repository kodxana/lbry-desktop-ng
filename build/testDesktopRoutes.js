/* eslint no-console:0, react/prop-types:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const router = require('react-router');
const { load } = require('./testStartup');
const pages = require('../ui/constants/pages');

const dependencies = {
  react: React,
  'react-router': router,
  'component/common/desktop-router': { withDesktopRouter: (component) => component },
  'constants/pages': pages,
  'constants/pageTitles': {},
  'constants/comment': {},
  'util/lbryURI': {},
  config: { WELCOME_VERSION: 1 },
  'util/buildHomepage': {},
  'effects/use-screensize': {},
};
// Stub page contents; exercise the production route definitions and real matcher.
const source = fs.readFileSync(path.join(__dirname, '../ui/component/router/view.jsx'), 'utf8');
for (const [, name] of source.matchAll(/from '(page\/[^']+)'/g)) {
  dependencies[name] = function Page(props) {
    return React.createElement(
      'output',
      null,
      JSON.stringify({
        page: name,
        params: router.useParams(),
        search: props.location?.search,
        category: props.dynamicRouteProps?.route,
      })
    );
  };
}
const { AppRoutes } = load('component/router/view.jsx', dependencies, { history: {} });
function route(pathname, extra = {}) {
  return AppRoutes({ location: { pathname, search: '?page=2', hash: '#details' }, welcomeVersion: 1, ...extra });
}
function match(pathname, extra) {
  const tree = route(pathname, extra);
  const matches = router.matchRoutes(router.createRoutesFromElements(tree.props.children), pathname);
  return matches?.at(-1);
}
const cases = {
  '/': 'home',
  '/$/wallet': 'wallet',
  '/$/wallet/': 'wallet',
  '/$/backup': 'backup',
  '/$/walletpassword': 'signInWalletPassword',
  '/$/signin': 'signIn',
  '/$/signup/email': 'signUp',
  '/$/verify': 'signInVerify',
  '/$/reset': 'passwordSet',
  '/$/resetpassword': 'passwordReset',
  '/$/settings': 'settings',
  '/$/settings/update_password': 'passwordUpdate',
  '/$/settings/notifications': 'settingsNotifications',
  '/$/settings/block_and_mute': 'listBlocked',
  '/$/settings/creator': 'settingsCreator',
  '/$/settings/ownComments': 'ownComments',
  '/$/tags': 'tagsFollowing',
  '/$/tags/manage': 'tagsFollowingManage',
  '/$/following': 'channelsFollowing',
  '/$/following/discover': 'channelsFollowingDiscover',
  '/$/channels': 'channels',
  '/$/channel/new': 'channelNew',
  '/$/buy': 'buy',
  '/$/receive': 'receive',
  '/$/send': 'send',
  '/$/list/fixture': 'collection',
  '/$/list/fixture/edit': 'collection',
  '/$/library': 'library',
  '/$/lists': 'lists',
  '/$/playlists': 'playlists',
  '/$/upload': 'publish',
  '/$/uploads': 'fileListPublished',
  '/$/dashboard': 'creatorDashboard',
  '/$/repost': 'repost',
  '/$/notifications': 'notifications',
  '/$/search': 'search',
  '/$/report': 'report',
  '/$/report_content': 'reportContent',
  '/$/help': 'help',
  '/$/top': 'top',
  '/$/welcome': 'welcome',
  '/$/discover': 'discover',
  '/@channel:abc': 'show',
  '/@channel:abc/video:def': 'show',
  '/video:def': 'show',
  '/100%': 'show',
  '/日本語': 'show',
};
for (const [pathname, page] of Object.entries(cases)) {
  assert.equal(match(pathname).route.element.type, dependencies['page/' + page], pathname);
  assert.equal(route(pathname, { welcomeVersion: 0 }).type, dependencies['page/welcome'], 'Setup must take precedence');
}
assert.equal(match('/unknown/too/many/segments'), undefined);
assert.equal(match('/$/list/fixture/edit').params.collectionId, 'fixture');
assert.equal(match('/@channel:abc/video:def').params.streamName, 'video:def');
const dynamicRoutes = [{ route: '/$/science', options: { tags: ['science'] } }];
const dynamic = match('/$/science/detail', { dynamicRoutes }).route.element;
assert.equal(dynamic.type, dependencies['page/discover']);
assert.equal(dynamic.props.dynamicRouteProps, dynamicRoutes[0]);
assert.equal(dynamic.props.location.search, '?page=2');

for (const [from, to] of [
  ['following/channels/manage', 'following/discover'],
  ['following/channels', 'following'],
  ['following/tags', 'tags'],
  ['tags/following/manage', 'tags/manage'],
  ['publish', 'upload'],
  ['published', 'uploads'],
]) {
  for (const suffix of ['', '/legacy']) {
    const element = match('/$/' + from + suffix).route.element;
    assert.equal(element.type, router.Navigate);
    assert.equal(element.props.to, '/$/' + to);
    assert.equal(element.props.replace, true, 'Old bookmarks must not create a back-button loop');
  }
}
const state = { from: 'notification' };
const decoded = route('/%40channel%3Aabc/video%3Adef', {
  location: { pathname: '/%40channel%3Aabc/video%3Adef', search: '?t=4', hash: '#comments', state },
});
assert.equal(decoded.type, router.Navigate);
assert.equal(decoded.props.to.pathname, '/@channel:abc/video:def');
assert.equal(decoded.props.to.search, '?t=4');
assert.equal(decoded.props.to.hash, '#comments');
assert.equal(decoded.props.state, state);
assert.equal(decoded.props.replace, true);
assert.equal(route('/bad%escape').type, router.Routes, 'Malformed escapes must not crash the router');
const markup = renderToStaticMarkup(
  React.createElement(router.MemoryRouter, { initialEntries: ['/$/list/fixture'] }, route('/$/list/fixture'))
);
assert(markup.includes('fixture') && markup.includes('page/collection'), 'Route params must reach the matched page');
console.log(
  'Desktop routes passed: setup, wallet/auth/settings, collections, dynamic discovery, LBRY URLs and legacy redirects'
);
