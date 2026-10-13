// Adapted from @meetfranz/electron-cookies 3.0.2; see electron-cookies.LICENSE.
'use strict';

const ToughCookie = require('tough-cookie');
const WebStorageCookieStore = require('tough-cookie-web-storage-store');

let cookieURL;

function enable(options) {
  cookieURL = options.url;

  let cookieStore = new WebStorageCookieStore(global.localStorage);
  let cookieJar = new ToughCookie.CookieJar(cookieStore);

  Object.defineProperty(global.document, 'cookie', {
    enumerable: true,
    configurable: true,
    get() {
      let url = _getLocationString();
      let cookies = cookieJar.getCookiesSync(url);
      return cookies.map((cookie) => cookie.cookieString()).join('; ');
    },
    set(cookieString) {
      let url = _getLocationString();
      cookieJar.setCookieSync(cookieString, url);
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
