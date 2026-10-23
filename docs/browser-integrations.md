# Browser integrations

This batch upgrades `react-google-recaptcha` from 2.1.0 to 3.1.0 and removes
`crypto-js`, `emoji-dictionary` and `proxy-polyfill`.

## Compatibility

Sign-in retains the existing reCAPTCHA v2 site key and confirmation endpoint.
The new wrapper removes its old unmount-time reset. Confirmation callbacks now
reject empty tokens, suppress duplicate requests and ignore responses after
navigation or replacement of the sign-in link. Expiry and widget errors return
to sign-in; a blocked script displays recovery guidance. Invalid links never
reach the confirmation API.

Comment suggestions and quick reactions use the installed `node-emoji` 2.2.0,
which already serves Markdown. All 1,570 legacy names, their ordering and exact
Unicode bytes match the old dictionary. Existing shortcodes, custom-emote
priority, keyboard selection and inserted spacing remain covered.

The SDK client uses Electron's native Proxy for unknown RPC methods. The shim
was redundant in the supported runtime; request parameters and error handling
are unchanged.

Legacy purchase-query signing uses Web Crypto HMAC-SHA-256 and the same Base64
encoding. Signing is asynchronous: an unsigned URL is never embedded, changes
to the address or email hide the previous destination, and obsolete results are
discarded. Signing failures show a recoverable error. Default NG builds have no
purchase-signing key; any future live purchase integration needs server-side
merchant signing rather than a secret distributed in a desktop bundle.

## Validation

The renderer tests exercise the real CAPTCHA wrapper with a synthetic Google
API and intercept only the confirmation transport. The blocked-script case
attempts the real script URL, which the fixture cancels. Purchase tests use a
synthetic signing key, resolve signatures out of order, inject failures and
unmount during signing. Every resulting iframe request is blocked and its
signature is independently checked with Node crypto. No live CAPTCHA, purchase,
personal account or funded wallet is used.

The sandboxed renderer checks Web Crypto against RFC 4231 and Node HMAC results
for UTF-8 text, empty messages and long keys without renderer Node privileges.
Existing Windows/Linux wallet backup, encryption, saved-password migration and
updater checks remain required, including real installed Windows upgrades on a
disposable hosted runner.

References: [reCAPTCHA changelog](https://github.com/dozoisch/react-google-recaptcha/blob/master/CHANGELOG.md),
[node-emoji API](https://github.com/omnidan/node-emoji#api),
[Web Crypto signing](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign),
[HMAC test vectors](https://www.rfc-editor.org/rfc/rfc4231).
