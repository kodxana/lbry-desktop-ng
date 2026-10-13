# Desktop cookie storage

The desktop pins `tough-cookie` 6.0.2, replacing 2.5.0. It still uses the
`__cookieStore__` localStorage key and the existing domain/path/name JSON layout.
The file-to-HTTPS URL mapping remains in `electron/desktopInfo.cjs`, so cookies
written by older installed builds retain their scope after an upgrade.

Version 6 parses string URLs before decoding their paths, while version 2 did
the reverse with the legacy URL parser. That changed the paths produced from
Windows backslashes, spaces and dot segments: the first installed-upgrade run
caught a default-path cookie becoming invisible. The adapter now passes an
explicit URL context: the host/protocol use native URL parsing, while the path
retains the old parser's representation. Existing cookies are not rewritten or
broadened to match more paths.

## Compatibility changes

`tough-cookie-web-storage-store` 1.0.0 needs a two-line Yarn patch: the current
`findCookies` API passes `allowSpecialUseDomain` before the callback, and domain
permutation must receive that flag. Without the patch, reading cookies throws
`callback is not a function`. The exact store version, resolution and patch are
committed with the lockfile; normal immutable installs apply them. This keeps
the on-disk format and avoids a second cookie migration.

[Version 6](https://github.com/salesforce/tough-cookie/releases/tag/v6.0.0)
treats HTTP localhost as secure by default. The desktop adapter explicitly sets
`allowSecureOnLocal: false` to retain its previous HTTPS-only behavior. Reads and
writes through `document.cookie` use `http: false`: HttpOnly cookies cannot be
read, created or overwritten there. Cookie-prefix and public-suffix checks use
the library defaults.

The new library no longer needs the renderer's `net.isIP` compatibility module.
Its removal does not expose networking or Node
APIs to the renderer. Upstream no longer officially supports non-Node environments
as of [version 5](https://github.com/salesforce/tough-cookie/releases/tag/v5.0.0),
so the pinned build is also tested in Electron with Node integration disabled.

## Password and account compatibility

Account tokens remain in the existing cookie store. Newly remembered passwords
continue to use the OS-protected main-process service. Legacy `saved_password`
entries remain readable by the separate migration code, including host-only
and domain/path variants. A verified restart is still required before removing
the recovery copy. Cookie reads or account-token changes must not remove it.

`build/tests/fixtures/legacy-cookies.json` was generated with tough-cookie 2.5.0
and the original store, using synthetic values and fixed timestamps. It contains
an account token, two password variants, an unrelated cookie and domain, and an
expired cookie. No real account or wallet data is included.

## Validation

- `node build/testCookies.js`: reads the old fixture, refreshes/reopens/deletes
  tokens, preserves passwords and unrelated domains, and checks expiry, host,
  path, public-suffix, Secure, HttpOnly, prefix and write-failure behavior. Mapped
  paths cover Windows separators, spaces, dot segments, Unicode and malformed
  percent-encoding; new cookies must use the same default path as old cookies.
- `node build/testRenderer.js`: migrates the old fixture through the actual
  password UI and IPC; exercises token preservation, sign-out and restart.
  The sandbox fixture reads old cookies and persists new values, including the
  mapped Windows path, without Node globals. Existing wallet-backup, document,
  media and updater UI tests also run.
- Desktop CI covers Windows DPAPI and an isolated Linux keyring, SDK encrypted
  wallet backup/restore, and packaged/development startup and shutdown.
- The installed-upgrade workflow reads root- and default-path cookies created
  by the published RC3, and retains the protected password and wallet through
  two real NSIS upgrades. Run it only on its disposable hosted Windows runner.

Live Odysee sign-in and macOS remain manual checks. Automated account tests use
synthetic tokens and block external account requests.
