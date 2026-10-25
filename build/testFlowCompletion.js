/* eslint no-console:0 */
const assert = require('assert').strict;
const React = require('react');
const { load } = require('./testStartup');
const plain = (value) => JSON.parse(JSON.stringify(value));
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

const merge = load('util/merge-sync-preferences.js', {}).default;
const local = freeze({
  type: 'object',
  version: 'local-version',
  value: { blocked: ['local', 'both'], subscriptions: ['local'], tags: ['local'], settings: { theme: 'dark' } },
});
const shared = freeze({
  type: 'object',
  version: 'shared-version',
  value: {
    blocked: ['both', 'shared'],
    subscriptions: ['shared'],
    tags: ['shared'],
    settings: { theme: 'light' },
    custom: 42,
  },
});
for (const [alternate, base] of [
  [local, shared],
  [shared, local],
]) {
  const merged = merge(alternate, base);
  assert.notEqual(merged, base);
  assert.notEqual(merged.value, base.value);
  assert.equal(merged.version, base.version);
  assert.equal(merged.value.settings, base.value.settings, 'The destination profile keeps its other settings');
  for (const key of ['blocked', 'subscriptions', 'tags']) {
    assert.deepEqual(plain(merged.value[key]), [...new Set([...base.value[key], ...alternate.value[key]])]);
  }
  assert.equal(merged.value.custom, base.value.custom);
}
assert.equal(merge({}, shared), shared, 'An absent source value leaves the destination alone');
assert.deepEqual(plain(merge(local, { version: 'empty' })), {
  version: 'empty',
  value: { blocked: ['local', 'both'], subscriptions: ['local'], tags: ['local'] },
});

const uri = load('util/lbryURI.js', {}, { URLSearchParams });
const blocked = load('redux/selectors/blocked.js', { reselect: require('reselect'), 'util/lbryURI': uri });
assert.deepEqual(plain(blocked.selectMutedChannels({})), []);
assert.deepEqual(plain(blocked.selectMutedAndBlockedChannelIds({})), []);
const state = freeze({
  blocked: { blockedChannels: ['lbry://@one#bbb', 'lbry://@missing', 'lbry://@duplicate#aaa'] },
  comments: { moderationBlockList: ['lbry://@two#aaa', 'lbry://@empty#'] },
});
assert.deepEqual(plain(blocked.selectMutedAndBlockedChannelIds(state)), ['aaa', 'bbb']);
assert.equal(blocked.makeSelectChannelIsMuted('lbry://@one#bbb')(state), true);

const stats = load('../extras/lbryinc/redux/selectors/stats.js', {
  reselect: require('reselect'),
  'redux/selectors/claims': { selectClaimIdForUri: () => 'fixture' },
});
assert.equal(stats.selectViewCountForUri({}, 'lbry://fixture'), 0);
assert.equal(stats.selectSubCountForUri({}, 'lbry://fixture'), 0);
assert.equal(stats.selectViewCountForUri({ stats: { viewCountById: { fixture: 3 }, subCountById: {} } }, 'fixture'), 3);

const Tooltip = load('component/common/tooltip.jsx', { react: React, '@mui/material/Tooltip': 'tooltip' }).default;
const tooltip = Tooltip({ title: 'Fixture', children: 'body', placement: 'left', followCursor: true });
assert.equal(tooltip.props.placement, 'left');
assert.equal(tooltip.props.followCursor, true);
assert.equal(tooltip.props.enterDelay, 300);
const ClaimTags = load('component/claimTags/view.jsx', {
  react: React,
  classnames: require('classnames'),
  'component/tag': 'tag',
}).default;
const tags = freeze(['zebra', 'apple', 'mature']);
assert(ClaimTags({ tags, followedTags: [], type: 'large' }));
assert.deepEqual(tags, ['zebra', 'apple', 'mature'], 'Rendering tags must not sort the saved claim in place');

let reportInput;
let updatedReport;
const reportDependencies = {
  react: {
    ...React,
    useEffect: () => {},
    useState: (initial) => {
      if (initial && typeof initial === 'object') {
        reportInput = freeze({ ...initial, category: 'previous category' });
        return [
          reportInput,
          (value) => {
            updatedReport = value;
          },
        ];
      }
      return [initial, () => {}];
    },
  },
  'component/common/form': { Form: 'form', FormField: 'field' },
  'component/common/desktop-router': { useDesktopHistory: () => ({ goBack: () => {} }) },
  'constants/report_content': load('constants/report_content.js', {}),
  'constants/form-field': {},
  'constants/icons': {},
  'util/country': { COUNTRIES: [] },
  'constants/email': {},
};
for (const component of [
  'button',
  'common/card',
  'claimPreview',
  'channelSelector',
  'spinner',
  'common/error-text',
  'common/icon',
]) {
  reportDependencies['component/' + component] = component;
}
const ReportContent = load('component/reportContent/view.jsx', reportDependencies).default;
const report = ReportContent({ claim: { value_type: 'stream', permanent_url: 'lbry://fixture' } });
const fields = [];
function visit(element) {
  if (!element || typeof element !== 'object') return;
  if (Array.isArray(element)) return element.forEach(visit);
  if (element.type === 'field') fields.push(element);
  visit(element.props?.children);
  visit(element.props?.actions);
}
visit(report);
assert(fields.length > 1);
fields[0].props.onChange();
assert.equal(updatedReport.type, fields[0].props.name);
assert.equal(updatedReport.category, '', 'Changing report type clears the previous category');
assert.equal(reportInput.type, '', 'Editing a report must not mutate the previous React state');
assert.equal(reportInput.category, 'previous category');

async function mediaSource() {
  let response;
  const requests = [];
  const resolve = load(
    'component/viewers/videoViewer/internal/videojs-functions.jsx',
    {},
    {
      URL,
      window: { location: { href: 'https://fixture/' } },
      fetch: async (...args) => {
        requests.push(args);
        if (response instanceof Error) throw response;
        return response;
      },
    }
  ).default;
  const run = () => resolve('https://fixture/video.mp4', 'video/mp4');
  response = { redirected: false, headers: new Headers() };
  assert.deepEqual(plain(await run()), { src: 'https://fixture/video.mp4', type: 'video/mp4' });
  for (const [url, type] of [
    ['https://fixture/master.m3u8?token=fixture', 'application/x-mpegURL'],
    ['https://fixture/dash.mpd?token=fixture', 'application/dash+xml'],
  ]) {
    response = { redirected: true, url, headers: new Headers() };
    assert.deepEqual(plain(await run()), { src: url, type });
  }
  response = { redirected: false, headers: new Headers({ 'content-type': 'application/vnd.apple.mpegurl' }) };
  assert.equal((await run()).type, 'application/x-mpegURL');
  assert.equal(requests[0][1].method, 'HEAD');
  response = new Error('fixture offline');
  await assert.rejects(run(), /fixture offline/);
}

mediaSource()
  .then(() =>
    console.log(
      'PASS immutable sync merges, report edits and tags, missing-state selectors, tooltip options and media source failure/redirect handling'
    )
  )
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
