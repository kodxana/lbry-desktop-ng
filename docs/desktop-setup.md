# Desktop setup

## Wallet hubs

Before the first wallet sync, the desktop starts the bundled SDK in a
settings-only mode: every component is skipped with runtime flags. The local
settings API is available, but no wallet, headers or hub connection is opened.
The picker checks the hubs returned by the SDK's `settings_get`.
The bundled defaults include the four Odysee hubs and the existing Grin,
Lizard and lbry.network hubs. The old `spv*.lbry.com` defaults are removed.
An explicit server override remains authoritative until the user changes it
or returns to automatic selection.
It shows successful response times first and labels unavailable servers. The
measurement includes DNS, TCP connection, `server.version` and `server.features`;
it is not ICMP ping or a measure of operator trust. Probes send no wallet addresses.
They require a compatible protocol and the LBRY mainnet genesis hash, use a
four-second deadline, and run at most four connections concurrently.

Automatic selection is the default. A custom `host:port` can be checked even
when every configured hub is unavailable. A manual choice is checked again
before being saved through the SDK settings API. **Start syncing** stops the
settings-only SDK cleanly and starts it with the saved configuration. The UI
continues as soon as the local API is ready, without waiting for wallet sync.
If that restart fails, the desktop returns to settings-only mode and restores
the previous choice; recovery failures are displayed.

During sync, **Choose another hub** stops the owned SDK and returns to the
picker. This remains available when a server passes its probe but later stalls.
Returning to automatic selection clears the custom setting, preserving SDK
discovery and failover. Old wallet/cloud preferences cannot overwrite the local
hub choice when preferences load after sync. Settings → Wallet Server remains
available for later changes.

After a successful SDK restart, `hub-setup-complete.json` in the desktop profile
skips the picker on later launches. Sync still offers the recovery button.
Existing NG profiles without this marker see the picker once. The component
skip flags are never written into the user's SDK configuration.

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
  custom address checks, automatic selection and successful/failed rollback.
- Old wallet preferences cannot replace the local hub choice. The sync poller
  retries API failures and ignores responses received after returning to setup.

`yarn test:sdk-isolation` also runs the real bundled SDK against local regtest
hubs. Settings-only startup leaves the wallet directory empty, contacts no hub,
does not read an initial-header file and leaves configuration unchanged. A hub
that stops responding after its probe can be replaced before sync finishes.
The recovered wallet retains its addresses and zero balance; all seven SDK
shutdowns complete without forced termination or pending-task destruction.
No funds or mainnet transactions are needed for these tests.

## Current Windows build, 2026-10-11

The rebuilt `0.54.0-rc.1` installer includes the updated wallet hubs from SDK
PR #29 and the interrupted-startup fix from pending PR #28. Its SHA-256 is
`c5d0439eaf0a2dac8918cfe2cba5b8884a25999cd9a0589ef2f0796f2edeece2`.
The bundled SDK's SHA-256 is
`fb165a3b1e272f1841a108d0b20a146e23aa515c9ba2100309faf8a1ee5b1cf6`;
the candidate manifest records its source tree and CI artifact. The installer
size and SHA-512 match `latest.yml`, and its updater targets this fork.

The build passed the setup, updater and real-SDK isolation checks described
above, including recovery from a stalled hub and seven clean SDK shutdowns.
A settings-only smoke test against the SDK extracted into the final package
confirmed all seven defaults, restored them after clearing a custom list,
created no wallet and exited cleanly. This build is ready for manual testing
of the picker before initial sync. Earlier playback and UI observations apply
only to the artifacts identified in their respective validation records.

## Earlier packaged Windows check, 2026-10-11

Before moving hub selection ahead of sync, the local NG installer was built
with Node 16.20.2 and Electron 17.2.0. Its
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
