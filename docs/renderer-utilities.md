# Renderer utility dependencies

The desktop's browser compatibility packages and UUID generator are upgraded
together:

| Package | Previous resolved version | Current version |
| --- | --- | --- |
| assert | 1.5.0 | 2.1.0 |
| buffer | 5.7.1 | 6.0.3 |
| stream-browserify | 2.0.2 | 3.0.0 |
| util | 0.10.3 | 0.12.5 |
| url | 0.11.0 | 0.11.4 |
| uuid | 8.3.2 | 14.0.3 |

UUID now ships as ESM and requires global Web Crypto. The existing named v4
imports are compatible with Webpack's browser export selection, Electron 44 and
Node 24. New collection, notification, icon and recommendation IDs retain their
UUID v4 format. Existing stored IDs do not need conversion.

Stream-browserify 3 uses readable-stream 3. The renderer continues to use its
browser implementation through the explicit Webpack fallback, alongside the
Buffer, assertion and util shims. Upgrading these packages does not require
exposing Node globals through the preload.

The URL package remains necessary for the legacy cookie path mapping. Its parsed
pathname preserves the original application's Windows separators and encoding
behavior. Cookie migration and domain/path boundary tests cover this caller.

Collection selectors use Object.fromEntries, already available in the supported
runtime and core-js entry point. The separate @ungap/from-entries shim is removed.
The unused lodash-es declaration is also removed; other packages' Lodash
dependencies retain their own compatible versions.

## Regression checks

The sandbox fixture bundles the same browser fallbacks as the application, with
no Node externals. An independent main-process check verifies binary Buffer views
and Base64 round-trips, split UTF-8 stream chunks, stream errors, inherited
constructors, assertion failures, URL fields and distinct UUID v4 values.
The renderer suite checks collection/notification IDs, collection persistence,
pending/edited collection precedence and playlist/mixed filtering.

These checks run alongside real document decoding, wallet ZIP and encrypted
backup restoration, remembered-password migration/restart/failure/forget, updater
consent and SDK shutdown. Windows/Linux packaging and startup tests, plus actual
installed Windows upgrades on disposable hosted runners, remain required.

References: [UUID breaking changes](https://github.com/uuidjs/uuid/blob/main/CHANGELOG.md),
[stream-browserify 3](https://github.com/browserify/stream-browserify/blob/master/CHANGELOG.md),
and [browser assertions with Webpack](https://github.com/browserify/commonjs-assert#usage-with-bundlers-that-dont-automatically-include-polyfills-for-nodejs-apis).
