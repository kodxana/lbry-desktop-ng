// Adapted from @meetfranz/electron-cookies 3.0.2; see electron-cookies.LICENSE.
'use strict';

const ToughCookie = require('tough-cookie');
const WebStorageCookieStore = require('tough-cookie-web-storage-store');

let cookieURL;

function enable(options) {
  cookieURL = options.url;

  let cookieStore = new WebStorageCookieStore(global.localStorage);
  // Keep Secure cookies restricted to HTTPS, including localhost, as in v2.
  let cookieJar = new ToughCookie.CookieJar(cookieStore, { allowSecureOnLocal: false });

  Object.defineProperty(global.document, 'cookie', {
    enumerable: true,
    configurable: true,
    get() {
      let url = _getLocationString();
      let cookies = cookieJar.getCookiesSync(url, { http: false });
      return cookies.map((cookie) => cookie.cookieString()).join('; ');
    },
    set(cookieString) {
      let url = _getLocationString();
      cookieJar.setCookieSync(cookieString, url, { http: false });
    },
  });
}

function _getLocationString() {
  return cookieURL;
}

function disable() {
  delete global.document.cookie;
}

exports.enable = enable;
exports.disable = disable;
