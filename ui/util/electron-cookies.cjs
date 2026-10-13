// Adapted from @meetfranz/electron-cookies 3.0.2; see electron-cookies.LICENSE.
'use strict';

const ToughCookie = require('tough-cookie');
const WebStorageCookieStore = require('tough-cookie-web-storage-store');
const { parse } = require('url/');

function enable(options) {
  const location = new URL(options.url);
  let decoded = options.url;
  try {
    decoded = decodeURI(decoded);
  } catch (_) {
    // v2 matched malformed percent-encoding verbatim.
  }
  // Retain v2's stored file-URL paths without decoding the URL's authority.
  const cookieURL = {
    hostname: location.hostname,
    protocol: location.protocol,
    pathname: parse(decoded).pathname,
  };

  let cookieStore = new WebStorageCookieStore(global.localStorage);
  // Keep Secure cookies restricted to HTTPS, including localhost, as in v2.
  let cookieJar = new ToughCookie.CookieJar(cookieStore, { allowSecureOnLocal: false });

  Object.defineProperty(global.document, 'cookie', {
    enumerable: true,
    configurable: true,
    get() {
      let cookies = cookieJar.getCookiesSync(cookieURL, { http: false });
      return cookies.map((cookie) => cookie.cookieString()).join('; ');
    },
    set(cookieString) {
      cookieJar.setCookieSync(cookieString, cookieURL, { http: false });
    },
  });
}

function disable() {
  delete global.document.cookie;
}

exports.enable = enable;
exports.disable = disable;
