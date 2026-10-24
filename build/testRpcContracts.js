/* eslint no-console:0 */
const assert = require('assert').strict;
const { load } = require('./testStartup');
const plain = (value) => JSON.parse(JSON.stringify(value));
const tick = () => new Promise((resolve) => setImmediate(resolve));

function client() {
  const calls = [];
  const timers = [];
  let reply = () => new Response(JSON.stringify({ result: true }));
  const module = load(
    'lbry.js',
    { '../desktop-settings.json': { apiPort: 5279 } },
    {
      fetch: async (url, options) => {
        calls.push({ url, headers: { ...options.headers }, body: JSON.parse(options.body) });
        return reply();
      },
      setTimeout: (fn, delay) => {
        timers.push({ fn, delay });
        return timers.length;
      },
    }
  );
  return {
    sdk: module.default,
    apiCall: module.apiCall,
    calls,
    timers,
    reply: (value) => {
      reply = value;
    },
  };
}

async function sdkRequests() {
  const { sdk, calls, reply, apiCall } = client();
  const headers = sdk.getApiRequestHeaders();
  sdk.setApiHeader('X-Fixture', 'retained');
  assert.equal(headers['X-Fixture'], 'retained', 'Existing header references must see updates');
  sdk.setDaemonConnectionString('http://sdk.test/rpc');
  const params = { password: '  synthetic λ password  ', blocking: true, data: 'unchanged-encrypted-data' };
  await sdk.sync_apply(params);
  const first = calls.pop();
  assert.equal(first.url, 'http://sdk.test/rpc?m=sync_apply');
  assert.equal(first.headers['Content-Type'], 'application/json-rpc');
  assert.equal(first.headers['X-Fixture'], 'retained');
  assert.deepEqual(first.body.params, params);
  assert.equal(first.body.jsonrpc, '2.0');
  assert.equal(typeof first.body.id, 'number');
  sdk.unsetApiHeader('X-Fixture');
  assert.equal(headers['X-Fixture'], undefined);

  sdk.alternateConnectionString = 'http://alternate.test/rpc';
  sdk.methodsUsingAlternateConnectionString = ['claim_search'];
  await sdk.claim_search({ claim_ids: ['fixture-claim'] });
  assert.equal(calls.pop().url, 'http://alternate.test/rpc?m=claim_search');
  await sdk.wallet_status();
  assert.equal(calls.pop().url, 'http://sdk.test/rpc?m=wallet_status');

  for (const name of [
    'wallet_encrypt',
    'wallet_unlock',
    'wallet_decrypt',
    'wallet_lock',
    'wallet_reconnect',
    'settings_set',
    'channel_sign',
    'publish',
    'future_sdk_method',
  ]) {
    await sdk[name]({ fixture: name });
    assert.equal(calls.pop().body.method, name);
  }
  assert.equal(sdk[Symbol.toStringTag], undefined, 'Missing symbols must not become SDK calls');
  const result = { txid: 'fixture-transaction', outputs: [] };
  sdk.setOverride('publish', async (options) => {
    assert.deepEqual(plain(options), { bid: '0.1' });
    return result;
  });
  assert.equal(await sdk.publish({ bid: '0.1' }), result);
  const overrideError = new Error('fixture override error');
  sdk.setOverride('publish', () => {
    throw overrideError;
  });
  await assert.rejects(sdk.publish({}), (error) => error === overrideError);

  for (const value of [false, 0, null, 'fixture', [1, 2], { is_locked: true }]) {
    reply(() => new Response(JSON.stringify({ result: value }), { status: 299 }));
    assert.deepEqual(plain(await sdk.wallet_status()), value, 'RPC results must retain their exact shape');
  }
  for (const envelope of [
    { error: { code: -1, message: 'fixture', data: { name: 'InvalidPasswordError' } } },
    { result: { error: 'fixture nested failure' } },
  ]) {
    reply(() => new Response(JSON.stringify(envelope)));
    await assert.rejects(sdk.wallet_status(), (error) => {
      assert.deepEqual(plain(error), envelope.error || envelope.result.error);
      return true;
    });
  }
  for (const error of ['fixture HTTP failure', { message: 'fixture HTTP failure' }]) {
    reply(() => new Response(JSON.stringify({ error }), { status: 503 }));
    await assert.rejects(sdk.wallet_status(), /fixture HTTP failure/);
  }
  for (const value of [null, [], 42, 'invalid', { error: {} }]) {
    reply(() => new Response(JSON.stringify(value), { status: 500 }));
    await assert.rejects(sdk.wallet_status(), /Protocol error/);
  }
  reply(() => new Response('{invalid'));
  await assert.rejects(sdk.wallet_status(), SyntaxError);
  const unavailable = new Error('fixture network failure');
  reply(() => {
    throw unavailable;
  });
  await assert.rejects(sdk.wallet_status(), (error) => error === unavailable);
  reply(() => new Response(JSON.stringify({ result: true })));
  let rejected;
  await apiCall(
    'status',
    {},
    () => {
      throw unavailable;
    },
    (error) => {
      rejected = error;
    }
  );
  assert.equal(rejected, unavailable, 'Callback errors must still reach the reject callback');

  for (const [mime, name, expected] of [
    ['video/mp4', null, 'video'],
    ['/broken', null, 'unknown'],
    ['', null, 'unknown'],
    [null, 'clip.MP4', 'video'],
    ['image/png', 'notes.md', 'document'],
    [null, 'comic.cbz', 'comic-book'],
    [null, 'mesh.stl', '3D-file'],
    [null, null, 'unknown'],
  ])
    assert.equal(sdk.getMediaType(mime, name), expected);
}

async function connectionRetries() {
  for (const failures of [2, 201]) {
    const { sdk, calls, timers, reply } = client();
    reply(() => {
      if (calls.length <= failures) throw new Error('SDK starting');
      return new Response(JSON.stringify({ result: { is_running: true } }));
    });
    const connected = sdk.connect();
    const outcome = connected.then(
      (value) => value,
      (error) => error
    );
    assert.equal(sdk.connect(), connected, 'Concurrent callers must share startup polling');
    for (let attempt = 0; attempt < Math.min(failures, 200); attempt++) {
      await tick();
      const timer = timers.shift();
      assert(timer, 'A failed startup probe must schedule its retry');
      assert.equal(timer.delay, attempt < 49 ? 400 : 1000);
      timer.fn();
    }
    const result = await outcome;
    if (failures === 2) assert.equal(result.is_running, true);
    else assert.match(result.message, /Unable to connect/);
    assert.equal(calls.length, Math.min(failures + 1, 201));
    assert.equal(timers.length, 0, 'Retry exhaustion must leave no scheduled probe');
  }
}

async function commentRequests() {
  const calls = [];
  let envelope = { result: { items: [] } };
  const comments = load(
    'comments.js',
    { config: { COMMENT_SERVER_API: 'https://comments.test/api' } },
    {
      fetch: async (url, options) => {
        calls.push({ url, options: plain(options) });
        return new Response(JSON.stringify(envelope));
      },
    }
  ).default;
  for (const method of [
    'moderation_block',
    'moderation_unblock',
    'moderation_block_list',
    'moderation_add_delegate',
    'moderation_remove_delegate',
    'moderation_list_delegates',
    'moderation_am_i',
    'comment_list',
    'comment_abandon',
    'comment_create',
    'comment_by_id',
    'comment_pin',
    'comment_edit',
    'reaction_list',
    'reaction_react',
    'setting_list',
    'setting_block_word',
    'setting_unblock_word',
    'setting_list_blocked_words',
    'setting_update',
    'setting_get',
    'super_list',
  ]) {
    assert.equal(typeof comments[method], 'function', 'Existing comment API method must remain available: ' + method);
  }
  const params = { comment: 'fixture text', claim_id: 'claim', signature: 'signed', signing_ts: '123' };
  await comments.comment_create(params);
  const request = calls.pop();
  assert.equal(request.url, 'https://comments.test/api?m=comment.Create');
  assert.deepEqual(JSON.parse(request.options.body), { jsonrpc: '2.0', id: 1, method: 'comment.Create', params });
  comments.setServerUrl('https://custom.test/api');
  assert.equal(comments.isCustomServer, true);
  await comments.moderation_block({ mod_channel_id: 'moderator', signature: 'signature' });
  assert.equal(calls.pop().url, 'https://custom.test/api?m=moderation.Block');
  envelope = { error: { message: 'fixture moderation failure' } };
  await assert.rejects(comments.comment_list({}), /fixture moderation failure/);
  comments.enabled = false;
  const count = calls.length;
  await assert.rejects(comments.comment_list({}), (error) => error === 'Comments are not currently enabled.');
  comments.setServerUrl(null);
  await assert.rejects(comments.comment_list({}), /Commenting server is not set/);
  assert.equal(calls.length, count, 'Disabled/unconfigured comments must not make requests');
  comments.setServerUrl(undefined);
  assert.equal(comments.url, 'https://comments.test/api');
  assert.equal(comments.enabled, true);
  assert.equal(comments.isCustomServer, false);
}

(async () => {
  await sdkRequests();
  await connectionRetries();
  await commentRequests();
  console.log('PASS SDK/comment RPC routing, unchanged payloads, errors, overrides, startup retries and media types');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
