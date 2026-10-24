# Desktop dependency progress

The original upstream baseline is commit
`d14c9141db0bfa2db9b5dcf78fcaa72912cc767a`. Count each package name once across
`dependencies` and `devDependencies`, and compare resolved versions in the two
lockfiles. Pinning a range to the same resolved version does not count as an
upgrade. Transitive dependencies and new packages are excluded from the original
denominator.

After the package-manager/security batch (based on merged PR #78):

| Original direct dependencies           | Count |
| -------------------------------------- | ----: |
| Upgraded to a newer resolved version   |    91 |
| Removed or replaced                    |    77 |
| Still at the original resolved version |     1 |
| Total                                  |   169 |

That is **99.4% upgraded, removed or replaced** (168/169). Strict version upgrades
alone account for 53.8% (91/169). This is package-count progress, not a measure of
remaining engineering effort, security or release readiness. The current direct
dependency set has 146 packages, including 54 additions/replacements.

PR #56 upgraded Flow 0.97.0 to 0.337.0 and flow-typed 3.8.0 to 4.1.1.
The checker runs again. Required checks load all 89 declaration files, reject
duplicate modules and exercise nine maintained dependency contracts alongside
the first-party global types. The declaration check is clean. The first
application pass replaces fresh-object Redux copies with spreads, reducing full
application diagnostics from 5,051 to 3,214. Shared UI export and React type
annotations reduce that to 2,908. Formatting and wallet-progress contracts reduce
that to 2,891. Search contracts reduce that to 2,836, and homepage contracts to
2,798. Comment contracts reduce that to 2,719, collection contracts to 2,644,
comment-input contracts to 2,586, form-control contracts to 2,521, claim contracts to 2,296,
renderer return/state contracts to 1,755, and SDK/comment API and async action
contracts to 1,549, then Redux action/reducer contracts to 1,363 and publishing
contracts to 1,221, then collection form/menu/control contracts to 1,067,
and content selectors/viewers to 926,
with no newly introduced diagnostics in these passes.
Required gates cover twenty-two shared UI/type source modules (39 invalid contracts)
and twelve utility modules, the throttle hook and search/comment constants (61 invalid contracts,
including homepage options, reaction counts, moderation state, stickers, playback and suggestions).
Search regressions cover filters, links, cache/pagination and request lifecycle.
Simplified filters now retain the full media options for later views, and unmatched
custom selections return the existing empty-selection value.
Homepage regressions cover category routes, language and tag filters, channel
limits, followed feeds and rendering. Stale subscription URIs no longer break
the homepage or leave missing channel IDs in a Following query.
Comment regressions cover list ordering, missing records, pagination, reactions,
visibility rules, mentions and display helpers. Moderation selectors now copy
lists before reversing them, and ownership checks use the claim-ID array's length.
Collection regressions cover ownership, draft precedence, missing entries,
shuffle membership and repeat navigation. Playback searches stop after one pass
when no entry can play; missing items cannot trigger reorder controls, and saved
edits can be changed before the published collection resolves. The collection
control source gate rejects nine invalid contracts. Renderer checks cover
unresolved records, scoped Enter/Escape shortcuts, pending selections, comma-separated
tags, metadata preservation, publish failure/success, menu ownership, one-shot
shuffle playback and public/private list deletion. Preview loading now dispatches
its thunk, and publish/update requests preserve existing location metadata.
Comment-input regressions cover mixed/repeated mentions and emoji, caret ranges,
claim IDs, Unicode, surrounding text and throttled edits. Completing an emoji
before punctuation now keeps the caret immediately after the inserted token.
Form-control contracts cover native refs/events, optional price props and the
Markdown editor's changes/options. Renderer checks cover price precision,
currency and clearing, checkbox labels, focus, textareas, disabled state and
submission alongside the existing wallet and Markdown editor tests.
Claim contracts distinguish streams, channels, collections and reposts, share the
reducer's state shape and preserve unresolved versus missing lookup results.
A separate source gate rejects 21 invalid claim/selector contracts. Runtime checks
cover pending claims, reposts, ownership, purchases, pagination, metadata and
numeric pending bids. URL sorting no longer mutates a cached claim list.
Unresolved downloads, reactions and tips fail safely; channel updates wait for
existing metadata, and support abandonment still works before claims finish loading.
Renderer tests cover unresolved tip recipients and confirmation/cancel/retry.
The larger renderer pass adds return annotations across components, modals and
pages, along with explicit empty-state types for wallet, setup, publishing and
media controls. It also types backup request tracking and forwarded modal props.
Production Babel output is identical for 311 of the 312 changed UI modules;
the backup component additionally declares its lifecycle fields and keeps the
generated request ID in a local constant. Source gates check the actual backup
and modal components against narrow presentation/IPC fixtures.
The API pass exposes the SDK client's declared interface, types comment RPC
responses and corrects claim resolution, moderation and sync callers. Its source
gate checks both actual clients and rejects thirteen invalid API contracts. Runtime
tests cover request payloads, errors, startup retries, signed comments, partial
moderation results and shared preferences. Encryption/decryption sync now waits
for the wallet operation to succeed before exporting and uploading changed data;
failed operations cannot upload a wallet with the wrong encryption state.
Saved-password precedence and first-time sync have dedicated regression cases.
The Redux pass types five action modules and three reducers, including async
failure results, numeric notification IDs, string comment parent IDs and claim
search state. A new source gate checks the collection/notification actions and
three reducers, rejecting eight invalid contracts. Transaction response types
distinguish the first claim output from later change outputs.
Collection fetches now populate the claim cache while retaining item order,
partial failures and newer local edits. Repost and collection publish failures
settle their promises; failed reposts do not show success or navigate away.
Notification list failures clear loading, and unblocking a commenter copies the
pending-unblock map. Regression tests cover these paths with synthetic requests,
alongside the existing wallet, password, updater and packaged SDK checks.
The utility pass also fixes omitted collection bids being serialized as "NaN".
The publishing pass shares the form state across actions, reducer and controls,
types native file/thumbnail events and adds a source gate rejecting nine invalid
contracts. Suggested names retain a valid default deposit; previews retain full
file paths, and Markdown selection works without a MIME registration. Thumbnail
failures preserve maturity metadata, and video snapshots use browser byte arrays.
Regression tests cover publish/preview payloads, metadata-only edits, exact decimal
fees, failures, license selection and thumbnail capture without submitting transactions.
The content-rendering pass adds typed playback/history state and viewer inputs,
with ten invalid source contracts. It fixes cleared floating playback, missing
watch progress, stale document reads and image observer cleanup. Real renderer
tests cover changing document sources, editor updates/disposal and late image
callbacks, alongside the document, comic and 3D viewer regressions.
PR #76 completed the application migration: the full check reports **zero errors**
and is now required on both Windows and Linux. Selected type contracts also
reject invalid calls, so a clean check cannot be obtained by widening those APIs.
Some legacy dependency declarations still use broad types; zero diagnostics does
not mean every dependency API is fully described. These type migrations do not change
the package-version percentages above; see
[Flow tooling](lint-tooling.md#flow-is-separate).

The one unchanged original package is localforage 1.10.0, still the latest stable
release on 2026-10-24. It is deliberately retained: replacing the storage engine
requires a separate migration and failure recovery design. The
[persistence/build batch](persistence-build-dependencies.md) replaces the two
remaining wrappers and updates their compression codec while preserving saved
bytes and storage locations. The [earlier media batch](legacy-media-adapters.md)
replaced country-data, ffmpeg-probe and videojs-event-tracking. These are
maintenance decisions, not version bumps made solely to reach 100%.

auto-launch 5.0.6 adds FreeBSD platform recognition; its Windows and Linux
registration implementations are unchanged. The desktop's scoped IPC regression
continues to cover the exposed commands without changing the user's login items.
source-map-explorer 2.5.3 updates dependencies for modern Node. Its span checker
misinterprets the source-map library's `Infinity` end-of-line marker. A pinned
patch treats that marker like its existing open-ended span representation,
keeping invalid-column and invalid-line checks enabled. `testBundleAnalysis.js`
checks exact UTF-8 byte attribution, HTML output and rejection of invalid maps.
The existing analysis command is also checked against the production bundle.

The [package-manager/security batch](package-manager-security.md) upgrades Yarn
and Electron 44, refreshes compatible nested dependencies and removes the obsolete
flow-typed download CLI. That CLI moves from the upgraded count to removed;
all maintained definitions and the required full Flow check remain in place.
