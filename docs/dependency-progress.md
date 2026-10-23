# Desktop dependency progress

The original upstream baseline is commit
`d14c9141db0bfa2db9b5dcf78fcaa72912cc767a`. Count each package name once across
`dependencies` and `devDependencies`, and compare resolved versions in the two
lockfiles. Pinning a range to the same resolved version does not count as an
upgrade. Transitive dependencies and new packages are excluded from the original
denominator.

After merged PR #54 (`814ddb2f332415d81e1a295757522af65bb3e50e`):

| Original direct dependencies           | Count |
| -------------------------------------- | ----: |
| Upgraded to a newer resolved version   |    87 |
| Removed or replaced                    |    71 |
| Still at the original resolved version |    11 |
| Total                                  |   169 |

That is **93.5% upgraded, removed or replaced** (158/169). Strict version upgrades
alone account for 51.5% (87/169). This is package-count progress, not a measure of
remaining engineering effort, security or release readiness. The current direct
dependency set has 149 packages, including 51 additions/replacements.

This batch upgrades History 4.10.1 to 5.3.0, auto-launch 5.0.5 to 5.0.6 and
source-map-explorer 2.5.2 to 2.5.3. Once merged, the same measure becomes **95.3%**
(161/169): 90 upgraded, 71 removed/replaced and eight unchanged.

The eight unchanged packages are country-data, ffmpeg-probe, flow-bin,
flow-typed, localforage, preprocess-loader, redux-persist-transform-compress and
videojs-event-tracking. On 2026-10-23, only the two Flow tools have newer stable
releases on npm. Their type-system migration needs its own work; an unchanged
latest release does not establish that a package is maintained.

auto-launch 5.0.6 adds FreeBSD platform recognition; its Windows and Linux
registration implementations are unchanged. The desktop's scoped IPC regression
continues to cover the exposed commands without changing the user's login items.
source-map-explorer 2.5.3 updates dependencies for modern Node; validate the
existing analysis command against the production bundle and source maps.
