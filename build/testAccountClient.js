/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');

async function main() {
  const filename = path.join(__dirname, '../extras/lbryinc/lbryio.js');
  const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const module = { exports: {} };
  const requests = [];
  const timers = new Set();
  const tokenWrites = [];
  let fetchResponse = async () => ({ status: 200, json: async () => ({ data: 'fixture response' }) });
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    __: (value) => value,
    require(name) {
      if (name === 'querystring') return require('querystring/'); // The browser package, not Node's built-in.
      if (name === 'constants/action_types') return {};
      if (name === 'lbry') return { status: async () => ({ installation_id: 'fixture-installation' }) };
      if (name.startsWith('@babel/runtime/')) return require(name);
      throw new Error('Unexpected dependency: ' + name);
    },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return fetchResponse(url, options);
    },
    AbortController,
    setTimeout: (callback, delay) => {
      assert.equal(delay, 15000);
      timers.add(callback);
      return callback;
    },
    clearTimeout: (callback) => timers.delete(callback),
    window: {},
  });
  const client = module.exports.default;
  client.authToken = 'fixture +& token';
  client.setLocalApi('https://account.invalid///');
  const params = {
    text: 'łąka +&',
    count: 0,
    enabled: false,
    absent: undefined,
    nil: null,
    list: [],
    nested: { a: 1 },
  };
  const encoded =
    'auth_token=fixture%20%2B%26%20token&text=%C5%82%C4%85ka%20%2B%26&count=0&enabled=false&absent=&nil=null&list=%5B%5D&nested=%7B%22a%22%3A1%7D';
  assert.equal(await client.call('user', 'me', params), 'fixture response');
  assert.equal(requests[0].url, 'https://account.invalid/user/me?' + encoded);
  assert.equal(requests[0].options.method, 'GET');
  assert.equal(await client.call('user', 'save', params, 'post'), 'fixture response');
  assert.equal(requests[1].url, 'https://account.invalid/user/save');
  assert.equal(requests[1].options.method, 'POST');
  assert.equal(requests[1].options.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(requests[1].options.body, encoded);
  assert.deepEqual(params.list, [], 'Request encoding must not mutate the input');
  assert.deepEqual(params.nested, { a: 1 });
  await assert.rejects(client.call('user', 'me', {}, 'delete'), /Invalid method/);
  client.enabled = false;
  await assert.rejects(client.call('user', 'me'), /disabled/);
  assert.equal(requests.length, 2);
  client.enabled = true;
  client.setOverride('setAuthToken', (token) => tokenWrites.push(token));
  const json = (status, data) => ({ status, json: async () => data });
  for (const response of [
    () => Promise.reject(Error('DNS failure')),
    ...[500, 502, 503, 504, 429].map((status) => async () => json(status, {})),
    async () => ({
      status: 200,
      json: async () => {
        throw new SyntaxError('HTML proxy response');
      },
    }),
    async () => json(200, null),
    async () => json(200, {}),
    async () => json(200, { success: true, data: null }),
  ]) {
    fetchResponse = response;
    const count = requests.length;
    await assert.rejects(client.authenticate(), { code: 'ACCOUNT_API_UNAVAILABLE' });
    assert.equal(requests.length, count + 1, 'Outages must not create an anonymous session');
    assert.equal(client.authToken, 'fixture +& token');
    assert.equal(client.authenticationPromise, null, 'An outage must allow a later retry');
    assert.equal(tokenWrites.length, 0);
    assert.equal(timers.size, 0);
  }
  for (const duringBody of [false, true]) {
    let aborted = false;
    fetchResponse = async (_url, { signal }) => {
      const stalled = () =>
        new Promise((resolve, reject) =>
          signal.addEventListener('abort', () => {
            aborted = true;
            reject(Error('aborted'));
          })
        );
      return duringBody ? { status: 200, json: stalled } : stalled();
    };
    const pending = client.call('sync', 'get', { hash: 'fixture-hash' }, 'post');
    const rejected = assert.rejects(pending, { code: 'ACCOUNT_API_UNAVAILABLE' });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(timers.size, 1);
    [...timers][0]();
    await rejected;
    assert(aborted, 'Timeout must abort the actual request, including its body');
    assert.equal(timers.size, 0);
  }
  fetchResponse = async () => json(200, { success: true, data: { id: 42 } });
  assert.equal((await client.authenticate()).id, 42, 'The saved account recovers without restarting');
  assert.equal(tokenWrites.length, 0);
  fetchResponse = async () => json(200, { success: false, error: 'no wallet found for this user' });
  await assert.rejects(client.call('sync', 'get'), /no wallet found/);
  fetchResponse = async () => json(403, { error: 'access denied' });
  await assert.rejects(client.authenticate(), /access denied/);
  assert.equal(tokenWrites.length, 0, 'Permission errors must not replace a saved token');
  fetchResponse = async (url) =>
    url.includes('/user/new')
      ? json(200, { data: { id: 43, auth_token: 'replacement-fixture-token' } })
      : json(401, { error: 'authentication required' });
  assert.equal((await client.authenticate()).id, 43);
  assert.deepEqual(tokenWrites, ['replacement-fixture-token']);
  fetchResponse = async () => {
    throw Error('network unavailable');
  };
  await assert.rejects(client.getExchangeRates());
  fetchResponse = async () => json(200, { data: { lbc_usd: 1, lbc_btc: 2, btc_usd: 3 } });
  assert.equal((await client.getExchangeRates()).LBC_USD, 1, 'Failed rates must not stay cached for twenty minutes');
  client.authToken = null;
  client.setOverride('getAuthToken', async () => {
    throw Error('token storage unavailable');
  });
  await assert.rejects(client.getAuthToken(), /token storage unavailable/);
  console.log(
    'PASS: account client encoding, outage recovery, aborted requests, token preservation and rate-cache recovery'
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
