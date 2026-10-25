/* eslint no-console:0 */
const assert = require('assert').strict;
const { load } = require('./testStartup');
const actions = load('constants/action_types.js', {});
const statuses = load('constants/thumbnail_upload_statuses.js', {});
const uri = load('util/lbryURI.js', {}, { URLSearchParams });
const reducer = load('redux/reducers/publish.js', {
  'util/redux-utils': load('util/redux-utils.js', {}),
  'util/lbryURI': uri,
  'constants/action_types': actions,
  'constants/thumbnail_upload_statuses': statuses,
  'constants/claim': load('constants/claim.js', { 'constants/tags': load('constants/tags.js', {}) }),
}).publishReducer;
let state;
let failPublish;
let uploadReply;
let statusReply = async () => ({ disabled: false });
const calls = [];
const requests = [];
const events = [];
const pending = { claim_id: 'pending', permanent_url: 'lbry://fixture#pending', value_type: 'stream' };
const response = { outputs: [pending, { amount: '0.001' }] };
const publish = load(
  'redux/actions/publish.js',
  {
    'constants/action_types': actions,
    'constants/modal_types': {},
    'constants/pages': {},
    'constants/thumbnail_upload_statuses': statuses,
    'constants/speech_urls': {
      SPEECH_STATUS: 'https://fixture.invalid/status',
      SPEECH_PUBLISH: 'https://fixture.invalid/upload',
    },
    'constants/licenses': load('constants/licenses.js', {}),
    'util/batch-actions': load('util/batch-actions.js', {}),
    'util/format-credits': load('util/format-credits.js', { './intlNumberFormat': {} }),
    'util/claim': load('util/claim.js', { 'constants/tags': load('constants/tags.js', {}), 'util/lbryURI': uri }),
    'redux/actions/claims': { doCheckPendingClaims: () => ({ type: 'check-pending' }) },
    'redux/actions/notifications': { doError: (error) => ({ type: actions.CREATE_ERROR, data: { error } }) },
    'redux/actions/app': { doOpenModal: (id, data) => ({ type: 'modal', id, data }) },
    'redux-first-history': { push: (path) => ({ type: 'navigate', path }) },
    analytics: { apiLogPublish: () => {} },
    'redux/selectors/claims': {
      selectMyClaims: () => state.myClaims,
      selectMyChannelClaims: () => state.channels,
      selectReflectingById: () => ({}),
    },
    'redux/selectors/publish': {
      selectPublishFormValues: () => state.publish,
      selectMyClaimForUri: () => state.editClaim,
    },
    lbry: {
      publish: async (params) => {
        calls.push(params);
        if (failPublish) throw failPublish;
        return response;
      },
    },
  },
  {
    clearInterval,
    File,
    Blob,
    FormData,
    fetch: async (url, options) => {
      if (url.endsWith('/status')) return { json: statusReply };
      requests.push(options);
      return uploadReply();
    },
  }
);
const getState = () => state;
const dispatch = (action) => {
  if (typeof action === 'function') return action(dispatch, getState);
  if (action.type === 'BATCH_ACTIONS') {
    action.actions.forEach(dispatch);
    return action;
  }
  events.push(action);
  state.publish = reducer(state.publish, action);
  return action;
};
const plain = (value) => JSON.parse(JSON.stringify(value));
const reset = () => {
  state = { publish: reducer(undefined, { type: 'init' }), channels: [] };
  events.length = 0;
  calls.length = 0;
};

async function prefilledName() {
  reset();
  const top = load('page/top/index.js', {
    'react-redux': { connect: (_select, perform) => () => perform(dispatch) },
    './view': {},
    'redux/actions/publish': publish,
    'redux/actions/claims': {},
    'redux-first-history': { push: (path) => ({ type: 'navigate', path }) },
    'constants/pages': { UPLOAD: 'upload' },
  }).default;
  top.beginPublish('chosen-name');
  assert.equal(state.publish.name, 'chosen-name');
  assert.equal(state.publish.bid, 0.01, 'Prefilling a new name must retain a valid default deposit');
  assert.equal(state.publish.title, '');
  assert.equal(state.publish.editingURI, undefined);
  await Promise.resolve();
}

async function payloads() {
  reset();
  state.channels = [{ name: '@owner', claim_id: 'owner-id' }];
  state.publish = {
    ...state.publish,
    name: 'fixture',
    title: 'Fixture',
    bid: 1.00000001,
    filePath: 'F:/fixture/video.mp4',
    channel: '@owner',
    description: 'Description',
    tags: [{ name: 'test' }],
    language: 'pl',
    contentIsFree: false,
    fee: { amount: '2.00000001', currency: 'LBC' },
    releaseTimeEdited: 123,
    optimize: true,
  };
  const completed = [];
  const failed = [];
  const previews = [];
  await dispatch(
    publish.doPublish(
      (value) => completed.push(value),
      (error) => failed.push(error),
      (value) => previews.push(value)
    )
  );
  assert.equal(calls[0].preview, true);
  assert.equal(calls[0].optimize_file, false);
  assert.equal(previews[0], response);
  assert.equal(completed.length, 0);
  assert.equal(state.publish.publishing, false, 'Preview must not enter the live publish state');
  await dispatch(
    publish.doPublish(
      (value) => completed.push(value),
      (error) => failed.push(error)
    )
  );
  const params = calls.at(-1);
  assert.equal(params.bid, '1.00000001');
  assert.equal(params.fee_amount, '2.00000001');
  assert.equal(params.channel_id, 'owner-id');
  assert.equal(params.file_path, 'F:/fixture/video.mp4');
  assert.equal(params.release_time, 123);
  assert.equal(params.optimize_file, true);
  assert.deepEqual(plain(params.tags), ['test']);
  assert.deepEqual(plain(params.languages), ['pl']);
  assert.equal(completed[0], response);
  const locations = [{ country: 'PL', city: 'Warsaw' }];
  state.editClaim = { name: 'fixture', value_type: 'stream', timestamp: 100, value: { release_time: 99, locations } };
  state.publish = { ...state.publish, filePath: undefined, releaseTimeEdited: undefined, contentIsFree: true };
  await dispatch(
    publish.doPublish(
      () => {},
      (error) => failed.push(error)
    )
  );
  assert.equal(calls.at(-1).release_time, 99);
  assert.deepEqual(plain(calls.at(-1).locations), locations);
  assert.equal('file_path' in calls.at(-1), false, 'A metadata-only edit must reuse existing content');
  assert.equal('fee_amount' in calls.at(-1), false);
  failPublish = Error('fixture SDK failure');
  await dispatch(
    publish.doPublish(
      () => {
        throw Error('Failure reported as success');
      },
      (error) => failed.push(error)
    )
  );
  assert.equal(failed.at(-1), failPublish);
  failPublish = undefined;
}

async function thumbnails() {
  reset();
  dispatch(publish.doUpdatePublishForm({ nsfw: true, tags: [{ name: 'mature' }], title: 'Keep my title' }));
  const file = new File(['fixture bytes'], 'thumbnail.png', { type: 'image/png' });
  const uploaded = [];
  uploadReply = async () => ({
    text: async () => JSON.stringify({ success: true, data: { serveUrl: 'https://fixture.invalid/image.png' } }),
  });
  await dispatch(publish.doUploadThumbnail(file, (url) => uploaded.push(url)));
  assert.equal(state.publish.uploadThumbnailStatus, statuses.COMPLETE);
  assert.equal(state.publish.thumbnail, uploaded[0]);
  assert.equal(await requests.at(-1).body.get('file').text(), 'fixture bytes');
  for (const reply of [
    async () => {
      throw Error('Failed to fetch');
    },
    async () => ({ text: async () => 'not json' }),
    async () => ({ text: async () => JSON.stringify({ success: false, message: 'rejected' }) }),
    async () => ({ text: async () => JSON.stringify({ success: true, data: {} }) }),
  ]) {
    uploadReply = reply;
    await dispatch(publish.doUploadThumbnail(file, (url) => uploaded.push(url)));
    assert.equal(state.publish.uploadThumbnailStatus, statuses.READY);
    assert.equal(state.publish.thumbnail, '');
    assert.equal(events.at(-1).type, actions.CREATE_ERROR);
    assert.equal(state.publish.nsfw, true, 'Upload failure must preserve the maturity setting');
    assert.deepEqual(plain(state.publish.tags), [{ name: 'mature' }]);
    assert.equal(state.publish.title, 'Keep my title');
  }
  assert.equal(uploaded.length, 1, 'Failed uploads must not invoke the success callback');
  for (const reply of [
    async () => ({ disabled: true }),
    async () => {
      throw Error('offline');
    },
  ]) {
    statusReply = reply;
    await dispatch(publish.doResetThumbnailStatus());
    assert.equal(state.publish.uploadThumbnailStatus, statuses.API_DOWN);
    assert.equal(state.publish.nsfw, true);
  }
  statusReply = async () => ({ disabled: false });
  await dispatch(publish.doResetThumbnailStatus());
  assert.equal(state.publish.uploadThumbnailStatus, statuses.READY);
}

async function editAndFailure() {
  reset();
  const claim = {
    name: 'fixture',
    amount: '1.00000001',
    value_type: 'stream',
    signing_channel: { name: '@owner' },
    value: {
      title: 'Existing title',
      description: 'Existing description',
      release_time: 123,
      fee: { amount: '0.0', currency: 'LBC' },
      license: 'Custom license',
      license_url: 'https://fixture.invalid/license',
      thumbnail: { url: 'https://fixture.invalid/image.png' },
      languages: ['pl'],
      tags: ['mature', 'test'],
    },
  };
  dispatch(publish.doPrepareEdit(claim, 'lbry://fixture#id'));
  assert.equal(state.publish.editingURI, 'lbry://fixture#id');
  assert.equal(state.publish.bid, 1.00000001);
  assert.equal(state.publish.contentIsFree, true, 'Zero fees must accept SDK decimal strings');
  assert.equal(state.publish.channel, '@owner');
  assert.equal(state.publish.releaseTime, 123);
  assert.equal(state.publish.releaseTimeEdited, undefined);
  assert.equal(state.publish.thumbnail, claim.value.thumbnail.url);
  assert.equal(state.publish.otherLicenseDescription, 'Custom license');
  assert.equal(state.publish.licenseUrl, claim.value.license_url);
  assert.equal(state.publish.nsfw, true);
  assert.deepEqual(plain(state.publish.tags), [{ name: 'mature' }, { name: 'test' }]);
  assert.deepEqual(plain(state.publish.languages), ['pl']);
  failPublish = Error('fixture publish rejected');
  dispatch(publish.doPublishDesktop(undefined, false));
  assert.equal(state.publish.publishing, true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.publish.publishing, false, 'A rejected publish must leave the form editable');
  assert.equal(state.publish.publishSuccess, false);
  assert.equal(events.at(-1).data.error, failPublish.message);
  assert.equal(state.publish.title, 'Existing title');
  failPublish = undefined;
  state.claims = { checkingReflector: true };
  dispatch(publish.doPublishDesktop('F:/fixture/video.mp4', false));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.publish.publishSuccess, true, 'Publishing must succeed while the claims list is unloaded');
  const modal = events.filter((event) => event.type === 'modal').at(-1);
  assert.equal(modal.data.isEdit, false);
  assert.equal(modal.data.filePath, 'F:/fixture/video.mp4');
  assert.equal(events.find((event) => event.type === actions.UPDATE_PENDING_CLAIMS).data.claims[0], pending);
}

async function main() {
  await prefilledName();
  await payloads();
  await thumbnails();
  await editAndFailure();
  console.log(
    'PASS prefilled publish defaults, preview/publish payloads, metadata edits and thumbnail upload failures'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
