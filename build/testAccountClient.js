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
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    __: (value) => value,
    require(name) {
      if (name === 'querystring') return require('querystring/'); // The browser package, not Node's built-in.
      if (name === 'constants/action_types' || name === 'lbry') return {};
      if (name.startsWith('@babel/runtime/')) return require(name);
      throw new Error('Unexpected dependency: ' + name);
    },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { status: 200, json: async () => ({ data: 'fixture response' }) };
    },
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
  console.log(
    'PASS: browser account client GET/POST encoding, Unicode, tokens, empty/JSON values and disabled requests'
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
