/* eslint no-console:0 */
const assert = require('assert').strict;
const { load } = require('./testStartup');
const reselect = require('reselect');
const actions = load('constants/action_types.js', {});
const modes = load('constants/file_render_modes.js', {});
const uri = load('util/lbryURI.js', {}, { URLSearchParams });
const tags = load('constants/tags.js', {});
const claimConstants = load('constants/claim.js', { 'constants/tags': tags });
const claims = load('redux/selectors/claims.js', {
  reselect,
  're-reselect': require('re-reselect'),
  'util/lbryURI': uri,
  'util/claim': load('util/claim.js', { 'constants/tags': tags, 'util/lbryURI': uri }),
  'constants/claim': claimConstants,
  'redux/selectors/wallet': { selectSupportsByOutpoint: () => ({}) },
  lbryinc: { selectBlackListedOutpoints: () => [] },
});
const selectors = load('redux/selectors/content.js', {
  reselect,
  'redux/selectors/claims': claims,
  'redux/selectors/file_info': {
    makeSelectMediaTypeForUri: () => (state) => state.mediaType,
    makeSelectFileNameForUri: () => (state) => state.fileName,
  },
  'redux/selectors/wallet': { selectBalance: (state) => state.balance },
  'redux/selectors/settings': { selectShowMatureContent: () => false },
  lbryinc: { selectCostInfoForUri: (state) => state.cost },
  'constants/file_render_modes': modes,
  'constants/claim': claimConstants,
  'util/file-name': load('util/file-name.js', {
    'path-browserify': require('path-browserify'),
    './desktop': { platform: 'win32' },
  }),
});
const reducer = load('redux/reducers/content.js', { 'constants/action_types': actions }).default;
const link = 'lbry://video#' + 'a'.repeat(40);
const fixture = (duration = 100) => ({
  claims: {
    byId: { a: { claim_id: 'a', txid: 'tx', nout: 0, value_type: 'stream', value: { video: { duration } } } },
    claimsByUri: { [uri.normalizeURI(link)]: 'a' },
    pendingById: {},
    abandoningById: {},
    myClaims: [],
  },
  content: reducer(undefined, { type: '@@init' }),
  balance: 5,
});
function update(state, type, data) {
  return { ...state, content: reducer(state.content, { type, data }) };
}
const empty = fixture();
assert.equal(selectors.selectPlayingUri({ claims: empty.claims }), null);
assert.equal(selectors.selectHistoryPageCount({ claims: empty.claims }), 0);
const floating = selectors.makeSelectIsPlayerFloating({ pathname: '/video' });
assert.equal(floating(empty), false);
let playing = update(empty, actions.SET_PRIMARY_URI, { uri: link });
playing = update(playing, actions.SET_PLAYING_URI, { uri: link, pathname: '/video' });
assert.equal(floating(playing), false, 'The primary video stays inline');
const away = update(playing, actions.SET_PRIMARY_URI, { uri: 'lbry://other' });
assert.equal(floating(away), true);
assert.equal(
  floating(update(away, actions.SET_PLAYING_URI, { uri: null })),
  false,
  'Clearing playback must hide the floating player'
);
const comment = update(playing, actions.SET_PLAYING_URI, {
  uri: 'lbry://comment',
  source: 'comment',
  pathname: '/video',
});
assert.equal(selectors.makeSelectIsPlayerFloating({ pathname: '/video', search: '?view=discussion' })(comment), false);
assert.equal(selectors.makeSelectIsPlayerFloating({ pathname: '/video', search: '?view=about' })(comment), true);
const watched = selectors.makeSelectContentWatchedPercentageForUri(link);
const position = selectors.makeSelectContentPositionForUri(link);
assert.equal(watched(empty), 0);
assert.equal(position(empty), null);
const resumed = update(empty, actions.SET_CONTENT_POSITION, { claimId: 'a', outpoint: 'tx:0', position: 25 });
assert.equal(position(resumed), 25);
assert.equal(watched(resumed), 25);
assert.equal(
  watched(update(empty, actions.SET_CONTENT_POSITION, { claimId: 'a', outpoint: 'old-tx:0', position: 10 })),
  0,
  'A replacement claim has no position yet'
);
assert.equal(
  watched(update(resumed, actions.SET_CONTENT_POSITION, { claimId: 'a', outpoint: 'tx:0', position: null })),
  100
);
assert.equal(watched(update(resumed, actions.CLEAR_CONTENT_POSITION, { claimId: 'a', outpoint: 'tx:0' })), 0);
for (const duration of [0, NaN, Infinity]) {
  assert.equal(watched({ ...fixture(duration), content: resumed.content }), 0);
}
const noDuration = fixture();
delete noDuration.claims.byId.a.value.video.duration;
assert.equal(watched({ ...noDuration, content: resumed.content }), 0);
let history = empty;
for (let i = 0; i < 52; i++)
  history = update(history, actions.SET_CONTENT_LAST_VIEWED, { uri: 'item' + i, lastViewed: i });
const before = JSON.stringify(history);
assert.equal(selectors.selectHistoryPageCount(history), 2);
assert.equal(selectors.makeSelectHistoryForPage(0)(history).length, 50);
assert.equal(selectors.makeSelectHistoryForPage(1)(history).length, 2);
assert.equal(selectors.selectRecentHistory(history).length, 10);
assert.equal(selectors.makeSelectHistoryForUri('item51')(history).lastViewed, 51);
assert.equal(selectors.makeSelectHasVisitedUri('missing')(history), false);
assert.equal(JSON.stringify(history), before, 'Selectors must not mutate persisted history');
const mode = selectors.makeSelectFileRenderModeForUri(link);
for (const [mediaType, fileName, contentType, expected] of [
  ['video', 'clip.mp4', 'video/mp4', modes.VIDEO],
  ['audio', 'clip.mp3', 'audio/mpeg', modes.AUDIO],
  ['audio', 'clip.ogg', 'audio/ogg', modes.VIDEO],
  ['image', 'cover.png', 'image/png', modes.IMAGE],
  ['document', 'readme.md', '', modes.MARKDOWN],
  ['application', 'file.pdf', 'application/pdf', modes.PDF],
  ['application', 'file.docx', '', modes.DOCX],
  ['application', 'file.zip', 'application/zip', modes.DOWNLOAD],
  ['model', 'file.glb', '', modes.CAD],
  ['comic-book', 'file.cbz', '', modes.COMIC],
  ['application', 'file.html', 'text/html', modes.HTML],
  ['text', 'file.txt', 'text/plain', modes.DOCUMENT],
  [undefined, undefined, undefined, modes.UNSUPPORTED],
]) {
  const state = fixture();
  state.claims.byId.a.value.source = { media_type: contentType };
  assert.equal(mode({ ...state, mediaType, fileName }), expected);
}
assert.equal(selectors.selectInsufficientCreditsForUri(empty, link), false);
assert.equal(selectors.selectInsufficientCreditsForUri({ ...empty, cost: { cost: 5 } }, link), false);
assert.equal(selectors.selectInsufficientCreditsForUri({ ...empty, cost: { cost: 6 } }, link), true);
console.log('PASS content playback, positions, render modes, history and purchase balance contracts');

const viewers = Object.fromEntries(
  [
    'videoViewer',
    'documentViewer',
    'docxViewer',
    'comicBookViewer',
    'threeViewer',
    'appViewer',
    'htmlViewer',
    'imageViewer',
    'pdfViewer',
  ].map((name) => ['component/viewers/' + name, () => null])
);
const listeners = new Set();
const reads = [];
let exited = 0;
const FileRender = load(
  'component/fileRender/view.jsx',
  {
    ...viewers,
    react: require('react'),
    classnames: require('classnames'),
    'constants/file_render_modes': modes,
    'constants/keycodes': load('constants/keycodes.js', {}),
    'util/window-controls': { leaveWindowFullscreen: () => exited++ },
    'util/desktop': {
      readDocument: (path) => {
        reads.push(path);
        return Promise.resolve(new Uint8Array());
      },
    },
    analytics: { playerLoadedEvent: () => {} },
  },
  {
    window: {
      addEventListener: (_event, listener) => listeners.add(listener),
      removeEventListener: (_event, listener) => listeners.delete(listener),
    },
  }
).default;
const view = new FileRender({ downloadPath: 'first.txt', renderMode: modes.DOCUMENT, currentTheme: 'dark' });
view.componentDidMount();
const initial = view.renderViewer();
view.props = { ...view.props, currentTheme: 'light' };
assert.equal(
  view.renderViewer().props.source.file,
  initial.props.source.file,
  'Theme changes must not start another document read'
);
assert.equal(view.renderViewer().key, initial.key);
view.props = { ...view.props, downloadPath: 'second.txt' };
const changed = view.renderViewer();
assert.notEqual(changed.key, initial.key, 'A different file must get a fresh viewer');
changed.props.source.file();
assert.deepEqual(reads, ['second.txt']);
for (const listener of listeners) listener({ keyCode: 27, preventDefault() {} });
assert.equal(exited, 1);
view.componentWillUnmount();
assert.equal(listeners.size, 0, 'Unmount must remove the exact native Escape handler');
console.log('PASS file viewer source identity, path changes and native keyboard cleanup');
