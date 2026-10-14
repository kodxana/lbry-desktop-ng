/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { CookieJar } = require('tough-cookie');
const WebStorageCookieStore = require('tough-cookie-web-storage-store');
const { legacyPasswordCookies } = require('../ui/util/password-storage.cjs');
const legacy = require('./tests/fixtures/legacy-cookies.json');
const source = fs.readFileSync(path.join(__dirname, '../ui/util/electron-cookies.cjs'), 'utf8');

function fixture(url, initial = null) {
  let raw = initial;
  const localStorage = {
    getItem: (key) => {
      assert.equal(key, '__cookieStore__');
      return raw;
    },
    setItem: (key, value) => {
      assert.equal(key, '__cookieStore__');
      raw = value;
    },
  };
  const document = {};
  const context = { exports: {}, require, URL, global: { document, localStorage } };
  vm.runInNewContext(source, context);
  const shim = context.exports;
  shim.enable({ url });
  return { document, localStorage, shim, jar: new CookieJar(new WebStorageCookieStore(localStorage)) };
}

const original = JSON.stringify(legacy);
const saved = fixture('https://lbry.tv/', original);
assert.equal(saved.localStorage.getItem('__cookieStore__'), original, 'Enabling the shim must not rewrite old storage');
assert(saved.document.cookie.includes('auth_token=fixture-auth-token'));
assert(saved.document.cookie.includes('saved_password=fixture-%20=value'));
assert(!saved.document.cookie.includes('expired='));
assert.deepEqual(legacyPasswordCookies(saved.localStorage, ['lbry.tv']).read(), [
  'fixture-%20=value',
  'fixture-%20=value',
]);
saved.document.cookie = 'auth_token=new-%20=value; Domain=lbry.tv; Path=/; Secure; SameSite=None';
saved.shim.enable({ url: 'https://lbry.tv/' });
assert(saved.document.cookie.includes('auth_token=new-%20=value'), 'Cookie bytes must survive reopening the jar');
for (const domain of ['lbry.tv', '.lbry.tv']) {
  saved.document.cookie = `auth_token=; Domain=${domain}; Path=/; Max-Age=-1`;
}
assert(!saved.document.cookie.includes('auth_token='));
assert(saved.document.cookie.includes('unrelated_cookie=preserve-me'));
assert.equal(saved.jar.getCookieStringSync('https://example.com/'), 'saved_password=unrelated');
assert.equal(legacyPasswordCookies(saved.localStorage, ['lbry.tv']).read().length, 2);
console.log('PASS: v2 cookie fixture, auth refresh/reopen/sign-out and legacy password/domain preservation');

// v2 decoded the mapped file URL before parsing it: backslashes became slashes,
// spaces were escaped again, and dot segments were retained in the stored path.
for (const [mapped, cookiePath] of [
  [
    'https://lbry.tv/C:%5CUsers%5Cfixture%5CLBRY%20Desktop%20NG%5Cresources%5Capp.asar%5Cindex.html',
    '/C:/Users/fixture/LBRY%20Desktop%20NG/resources/app.asar',
  ],
  ['https://lbry.tv/..%5Capp.asar%5Cindex.html', '/../app.asar'],
  ['https://lbry.tv/za%C5%BC%C3%B3%C5%82%C4%87/index.html', '/zażółć'],
  ['https://lbry.tv/malformed%20%/index.html', '/malformed%20%'],
]) {
  const data = {
    'lbry.tv': {
      [cookiePath]: {
        old_path: {
          ...legacy['lbry.tv']['/'].unrelated_cookie,
          key: 'old_path',
          value: 'preserve-path',
          path: cookiePath,
        },
      },
    },
  };
  const mappedCookie = fixture(mapped, JSON.stringify(data));
  assert(
    mappedCookie.document.cookie.includes('old_path=preserve-path'),
    'Retain the v2 mapped cookie path: ' + cookiePath
  );
  mappedCookie.document.cookie = 'new_path=preserve-path';
  const stored = JSON.parse(mappedCookie.localStorage.getItem('__cookieStore__'));
  assert.equal(stored['lbry.tv'][cookiePath].new_path.path, cookiePath, 'New writes must keep the old default path');
}
console.log('PASS: legacy mapped file URLs preserve Windows separators, spaces, dot segments and Unicode paths');

const scoped = fixture('https://lbry.tv/old/view');
scoped.document.cookie = 'host=private; Path=/';
scoped.document.cookie = 'shared=domain; Domain=lbry.tv; Path=/';
scoped.document.cookie = 'path=restricted; Path=/old';
assert(scoped.document.cookie.includes('path=restricted'));
scoped.shim.enable({ url: 'https://lbry.tv/older' });
assert(!scoped.document.cookie.includes('path=restricted'), 'A path prefix without a slash boundary must not match');
scoped.shim.enable({ url: 'https://sub.lbry.tv/' });
assert.equal(scoped.document.cookie, 'shared=domain', 'Host-only cookies must not leak to subdomains');
assert.throws(() => {
  scoped.document.cookie = 'wrong=domain; Domain=example.com';
}, /domain/i);
assert.throws(() => {
  scoped.document.cookie = 'wrong=suffix; Domain=tv';
}, /public suffix/i);
scoped.shim.enable({ url: 'https://example.com/' });
assert.equal(scoped.document.cookie, '', 'Cookies must not leak to an unrelated domain');
console.log('PASS: cookie domain, public-suffix, host-only and path boundaries');

for (const host of ['localhost', '127.0.0.1', '[::1]']) {
  const local = fixture(`https://${host}/`);
  local.document.cookie = 'secure=value; Secure; Path=/';
  local.document.cookie = 'plain=value; Path=/';
  assert(local.document.cookie.includes('secure=value'));
  local.shim.enable({ url: `http://${host}/` });
  assert.equal(local.document.cookie, 'plain=value', 'Preserve HTTPS-only Secure cookies on ' + host);
}
console.log('PASS: localhost, IPv4 and IPv6 cookies without a networking shim; Secure still requires HTTPS');

const protectedCookies = fixture('https://lbry.tv/');
protectedCookies.jar.setCookieSync('server=private; HttpOnly; Path=/', 'https://lbry.tv/');
assert.equal(protectedCookies.document.cookie, '', 'document.cookie must not expose HttpOnly values');
assert.throws(() => {
  protectedCookies.document.cookie = 'server=replaced; Path=/';
}, /HttpOnly/i);
assert.throws(() => {
  protectedCookies.document.cookie = 'new=private; HttpOnly; Path=/';
}, /HttpOnly/i);
assert.equal(protectedCookies.jar.getCookieStringSync('https://lbry.tv/'), 'server=private');
protectedCookies.document.cookie = '__Host-valid=value; Secure; Path=/';
protectedCookies.document.cookie = '__Host-invalid=value; Secure; Path=/; Domain=lbry.tv';
assert.equal(protectedCookies.document.cookie, '__Host-valid=value');
const beforeFailure = protectedCookies.localStorage.getItem('__cookieStore__');
protectedCookies.localStorage.setItem = () => {
  throw new Error('Storage unavailable');
};
assert.throws(() => {
  protectedCookies.document.cookie = 'new=value; Path=/';
}, /Storage unavailable/);
assert.equal(protectedCookies.localStorage.getItem('__cookieStore__'), beforeFailure);
protectedCookies.shim.disable();
assert.equal(Object.getOwnPropertyDescriptor(protectedCookies.document, 'cookie'), undefined);
console.log('PASS: HttpOnly/prefix restrictions, storage-write failure preservation and shim cleanup');
