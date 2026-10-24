# Desktop dependency progress

The original upstream baseline is commit
`d14c9141db0bfa2db9b5dcf78fcaa72912cc767a`. Count each package name once across
`dependencies` and `devDependencies`, and compare resolved versions in the two
lockfiles. Pinning a range to the same resolved version does not count as an
upgrade. Transitive dependencies and new packages are excluded from the original
denominator.

After merged PR #56 (`9efa640cad40f3653d8573c421904a929c9b5c32`):

| Original direct dependencies           | Count |
| -------------------------------------- | ----: |
| Upgraded to a newer resolved version   |    92 |
| Removed or replaced                    |    71 |
| Still at the original resolved version |     6 |
| Total                                  |   169 |

That is **96.4% upgraded, removed or replaced** (163/169). Strict version upgrades
alone account for 54.4% (92/169). This is package-count progress, not a measure of
remaining engineering effort, security or release readiness. The current direct
dependency set has 149 packages, including 51 additions/replacements.

PR #56 upgraded Flow 0.97.0 to 0.337.0 and flow-typed 3.8.0 to 4.1.1.
The checker runs again. Required checks load all 88 declaration files, reject
duplicate modules and exercise nine maintained dependency contracts alongside
the first-party global types. The declaration check is clean. The first
application pass replaces fresh-object Redux copies with spreads, reducing full
application diagnostics from 5,051 to 3,214. Shared UI export and React type
annotations reduce that to 2,908. Formatting and wallet-progress contracts reduce
that to 2,891. Search contracts reduce that to 2,836, and homepage contracts to
2,798. Comment contracts reduce that to 2,719, with no newly introduced diagnostics.
Required gates cover fourteen shared UI source modules (18 invalid contracts)
and ten utility modules plus search and comment constants (46 invalid contracts,
including homepage options, reaction counts, moderation state and stickers).
Search regressions cover filters, links, cache/pagination and request lifecycle.
Simplified filters now retain the full media options for later views, and unmatched
custom selections return the existing empty-selection value.
Homepage regressions cover category routes, language and tag filters, channel
limits, followed feeds and rendering. Stale subscription URIs no longer break
the homepage or leave missing channel IDs in a Following query.
Comment regressions cover list ordering, missing records, pagination, reactions,
visibility rules, mentions and display helpers. Moderation selectors now copy
lists before reversing them, and ownership checks use the claim-ID array's length.
The utility pass also fixes omitted collection bids being serialized as "NaN".
Remaining application errors and untyped
dependency stubs still need work. These type migrations do not change
the package-version percentages above; see
[Flow tooling](lint-tooling.md#flow-is-separate).

The six unchanged packages are country-data, ffmpeg-probe, localforage,
preprocess-loader, redux-persist-transform-compress and videojs-event-tracking.
On 2026-10-23, none has a newer stable release on npm. An unchanged latest release
does not establish that a package is maintained; these need maintenance and
replacement decisions rather than version bumps just to reach 100%.

auto-launch 5.0.6 adds FreeBSD platform recognition; its Windows and Linux
registration implementations are unchanged. The desktop's scoped IPC regression
continues to cover the exposed commands without changing the user's login items.
source-map-explorer 2.5.3 updates dependencies for modern Node. Its span checker
misinterprets the source-map library's `Infinity` end-of-line marker. A pinned
patch treats that marker like its existing open-ended span representation,
keeping invalid-column and invalid-line checks enabled. `testBundleAnalysis.js`
checks exact UTF-8 byte attribution, HTML output and rejection of invalid maps.
The existing analysis command is also checked against the production bundle.
