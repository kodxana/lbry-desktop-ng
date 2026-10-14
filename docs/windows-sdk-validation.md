# Windows SDK integration validation

Validated on 2026-10-11 using the packaged **LBRY SDK Test** application on
Windows x64. The desktop source was `3e5af5514ad3cc3d9a7213ada25080a8a01a8aec`,
based on upstream Desktop 0.53.9 at `d14c9141db0bfa2db9b5dcf78fcaa72912cc767a`.
Later community documentation and repository metadata changes do not change
the identity of this tested artifact.

## Artifact identity

- SDK source: `13c196bc58892a76a7b16376fdb8bfaf184e3991`, including
  [SDK NG PR #27](https://github.com/kodxana/lbry-sdk-ng/pull/27).
- SDK provenance and platform hashes: [sdk-candidate.json](../build/sdk-candidate.json).
- Windows SDK SHA-256:
  `c69fcb2d7e8e62cc7cfc726844c410abf08908304ca1eb304585d282e905a2ee`.
- Locally tested ZIP: `LBRY-SDK-Test-0.53.9-pr27-windows-x64.zip`.
- ZIP SHA-256:
  `bf64910f279ad792ff472f179ceb40809c9792dfd899b8574195eba4a8fecab8`.

The SDK reports `0.114.0rc4`, but this candidate contains a later shutdown fix.
The public rc4 release is a different binary. No desktop release was published
as part of this validation.

## Checks and results

| Check | Result |
| --- | --- |
| Packaged application startup | Home screen opened; mainnet light wallet synchronized. |
| Wallet persistence | Same 20 public addresses after restart; balance remained zero. |
| Isolation | Separate SDK, wallet, downloads and desktop profiles; dedicated API/media/peer ports. |
| Existing-service protection | Occupied TCP and UDP ports refused; no requests sent to the existing service. |
| SDK pin | Wrong binary hash rejected; failed import preserved the cached executable. |
| Packaged SDK lifecycle regression | Two local test-wallet startup/shutdown cycles passed. |
| Playback | Two free MP4 videos played through the isolated SDK media server. |
| Player controls | UI pause/resume and backward seek passed. |
| Decoder evidence | Playback time, video frames and decoded audio advanced; sampled decoder errors and dropped frames were zero. |
| Uncached stream | A previously uncached 16.619-second clip played to the end, decoding 497 frames. |
| HTTP seeking | Three byte ranges matched the saved file exactly, including a range across a blob boundary; all returned HTTP 206. |
| Interrupted download | Stopped after one of five blobs, restarted desktop/SDK, then resumed and completed. |
| Cache persistence | The first verified 2 MiB blob retained its hash and modification time through restart and completion. |
| Completed file | 9,194,157 bytes; SHA-384 matched the hash published in its claim. |
| Shutdown | Window close stopped desktop and SDK without forced termination or leftover test listeners. |
| Windows integration | Existing LBRY protocol and autostart registration fingerprints unchanged. |

Download interruption used the SDK's `file_set_status` stop/start controls with
a full application restart between them. On stop, the SDK discarded the partial
output file and retained verified blobs; resume reconstructed the saved file
using that cache. Completion took 3.72 seconds in this run, not a performance
guarantee.

The download/longer playback sample was free MP4 claim
`255e14b7e184d5c788dd2ba67b700c99ee7c473b`; its published SHA-384 was
`44b54a7a813a6e276c3f8912cc817fb54607e600f25174ce6570ff1a7186b4d99a0d4fc65d94cf64c48a209c0477ee53`.
The uncached playback sample was free MP4 claim
`4cf830a3d7854d152228f5e6596d25392cdae838`.

## Limits

This establishes the tested Windows paths, not complete desktop compatibility.
Other formats, Linux/macOS, paid content, funded transactions, wallet
encryption/backup UI, and account/cloud services were not exercised. Audio
decoding was verified; this was not a separate listening or audio-device test.
Pause plus application restart does not establish recovery from power loss,
an OS crash or a network outage.

Legacy DHT/tracker/exchange-rate service warnings remain in the SDK logs and did
not block these checks. Changed application code had no ESLint errors; four
existing application warnings and eight inherited Webpack-config lint errors
were recorded separately. CI and release automation for this fork are still
pending.
