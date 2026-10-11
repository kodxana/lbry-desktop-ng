# Desktop setup

## Wallet hubs

The welcome flow checks the hubs returned by the bundled SDK's `settings_get`.
It shows successful response times first and labels unavailable servers. The
measurement includes DNS, TCP connection, `server.version` and `server.features`;
it is not ICMP ping or a measure of operator trust. Probes send no wallet addresses.
They require a compatible protocol and the LBRY mainnet genesis hash, use a
four-second deadline, and run at most four connections concurrently.

Automatic selection is the default. A manual choice is checked again before
being saved through the SDK settings API. The desktop stops its owned SDK
cleanly, starts it with the saved configuration and waits up to 60 seconds for
the wallet connection. On failure it restores the previous setting and restarts
again. Recovery errors are reported rather than claiming the choice succeeded.
Returning to automatic selection clears the custom setting, preserving the
SDK's discovery and failover behavior. Settings → Wallet Server remains available
for later changes or manually entered addresses.

This step follows the existing SDK bootstrap and initial wallet synchronization.
It does not choose a hub before the first network connection and is not yet a
recovery screen for a bootstrap that cannot reach any hub.

## Windows storage

The original desktop ran `wmic logicaldisk`; that executable is absent on the
Windows machine used for this validation. The replacement calls
[`GetDiskFreeSpaceExW`](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getdiskfreespaceexw)
through hidden Windows PowerShell, querying the SDK's actual `blobfiles`
directory. Paths go through standard input, not shell interpolation. Available
space respects the caller's quota, retains 64-bit values, and is converted to
the KiB units expected by the UI. The Unix path uses `df -kP` with a separate
path argument; Linux/macOS execution remains unvalidated.

A failed check clears stale capacity readings and offers a retry. Setup treats
unknown capacity separately from a full drive, and continuing with unknown
capacity does not change hosting limits. PowerShell policy restrictions or an
unavailable storage directory can still prevent a reading; installing WMIC is
not required.

## Regression checks

Run `yarn test:desktop-setup` with the documented Node 16.20.2 build environment:

- Real Windows capacity query with spaces, Unicode and shell metacharacters in
  the directory name; missing directories; zero free space; capacity above 4 GiB.
- Rendering and submission of the hosting screen with unknown capacity versus
  a full drive; unknown capacity preserves hosting settings.
- Local TCP hub fixtures: fragmented JSON, incompatible protocol, wrong network,
  invalid/oversized replies, refused connections, timeouts and concurrency limits.
- SDK host/port tuple normalization, duplicate choices, a failed second probe,
  automatic selection, saved custom choices and both successful/failed rollback.

`yarn test:sdk-isolation` also runs the real bundled SDK against local regtest
hubs. A hub that stops responding after the probe forces a rollback. The
previous server list, wallet addresses and zero balance survive; all five SDK
shutdowns complete without forced termination or pending-task destruction.
No funds or mainnet transactions are needed for these tests.

## Packaged Windows check, 2026-10-11

The local NG installer was built with Node 16.20.2 and Electron 17.2.0. Its
SHA-256 is `ff53bf9d107267bfc63ecafd5dd791c074995503db7fd9ea1b0e7edee53bf4e1`.
The bundled SDK retained the pinned SHA-256 from `build/sdk-candidate.json`, and
the installer's SHA-512 matched `latest.yml`.

In the unpacked application, first-run setup displayed all 12 SDK-configured
hubs with response times or failure labels. Selecting `hub.lbry.grin.io:50001`
restarted the owned SDK, saved that choice, connected the test wallet and advanced
setup. The test wallet's address digest and zero balance were unchanged.
The hosting screen then obtained capacity successfully and displayed its
calculated hosting allowance. The test ended without applying that allowance;
the app and SDK shut down normally. These observations are not a guarantee of
any particular hub's continued availability.
