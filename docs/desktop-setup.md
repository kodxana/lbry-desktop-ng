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

## Startup presentation

Hub selection, startup and the getting-started pages use the existing desktop
dark theme. The startup screens reuse the first-run columns, Yrbl illustration,
section typography, buttons and form fields. The spinning splash animation and
its toggle are removed.

Startup shows the connected hub and the SDK's header progress when available.
Header completion is not presented as overall wallet readiness: history and
other startup checks may still be running. If the reported state stops changing
for 45 seconds, the screen offers a plain waiting message alongside hub recovery.
Polling alone does not reset this timer, and a locked wallet still requires the
existing unlock dialog.

SDK PR #30 measures header progress from the height present at startup to the
connected hub's reported tip. Only applied headers count; downloaded headers
waiting for validation do not. During catch-up the SDK keeps up to four header
batches in flight over the same hub connection, then validates and applies them
in order. It does not benchmark hubs or open extra hub connections for sync.
The existing desktop progress display consumes this corrected SDK status.

Returning to hub selection retains the other addresses checked during that app
session and probes them again. Remembering an address does not bypass its check
or change the saved wallet configuration. The custom-address option remains
available, including when no listed hub responds.

## Windows storage

The original desktop ran `wmic logicaldisk`; that executable is absent on the
Windows machine used for this validation. The replacement calls
[`GetDiskFreeSpaceExW`](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getdiskfreespaceexw)
through hidden Windows PowerShell, querying the SDK's actual `blobfiles`
directory. Paths go through standard input, not shell interpolation. Available
space respects the caller's quota, retains 64-bit values, and is converted to
the KiB units expected by the UI. The Unix path uses `df -kP` with a separate
path argument. The Linux package tests exercise that path with real directories;
macOS execution remains unvalidated.

A failed check clears stale capacity readings and offers a retry. Setup treats
unknown capacity separately from a full drive, and continuing with unknown
capacity does not change hosting limits. PowerShell policy restrictions or an
unavailable storage directory can still prevent a reading; installing WMIC is
not required.

## Regression checks

Run `yarn test:desktop-setup` with the documented Node 24.21.0 build environment:

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
- Header progress rejects missing or invalid percentages and does not imply
  wallet readiness. Unchanged status does not reset the waiting timer; real
  progress clears the waiting notice. Recovery rechecks session hub alternatives.

`yarn test:sdk-isolation` also runs the real bundled SDK against local regtest
hubs. Settings-only startup leaves the wallet directory empty, contacts no hub,
does not read an initial-header file and leaves configuration unchanged. A hub
that stops responding after its probe can be replaced before sync finishes.
The recovered wallet retains its addresses and zero balance; all seven SDK
shutdowns complete without forced termination or pending-task destruction.
No funds or mainnet transactions are needed for these tests.

## RC1 Windows build, 2026-10-11

The rebuilt `0.54.0-rc.1` installer includes the header progress and catch-up
improvements from merged SDK PR #30, the updated wallet hubs from PR #29 and
the interrupted-startup fix from pending PR #28. Its SHA-256 is
`0c11a572f2dfcc5bd3d7b95071bc97c05abdd5f4cfc8d1722aa6c545680aae9a`.
The bundled SDK's SHA-256 is
`ca152fa170bcba1948fae455eb84a622700eb6881e1a3e7bfbd9d31e2e666c57`;
the candidate manifest records its source tree and CI artifact. The installer
size and SHA-512 match `latest.yml`, and its updater targets this fork. The
packaged `SDK-CANDIDATE.json` and embedded startup checks match the source pin.

The build passed the setup, updater and real-SDK isolation checks described
above, including recovery from a stalled hub and seven clean SDK shutdowns.
The combined SDK passed 21 focused progress, header-download and interrupted
startup tests locally, plus the native Windows CI wallet and packaged-daemon
checks in [run 38164960994](https://github.com/kodxana/lbry-sdk-ng/actions/runs/38164960994).
The first NSIS packaging attempt could not access Windows' short temporary
path; packaging succeeded with a workspace-local temporary directory.
The packaged UI contains the new progress and recovery screens and no longer
contains the spinning splash toggle. Hub selection, header progress and return
to settings-only setup were exercised in a disposable profile before the final
styling revision. The final appearance still needs manual acceptance; that
revision reuses the existing getting-started layout and dark theme. Earlier
playback and UI observations apply only to the artifacts identified in their
respective validation records.

For a first-sync test, use a new empty directory with the unpacked executable's
`--ng-profile=<absolute-path>` option. Choose a hub and start syncing. Headers
already cached in an existing profile can make initial sync too short to
observe. Closing and reopening the same test profile checks catch-up from its
saved state; never delete an existing wallet to repeat this test. This rebuild
does not change the desktop layout or its dark theme.

## Transaction-history progress, 2026-10-12

The desktop now consumes the separate `status.wallet.history_sync` field merged
in [SDK PR #31](https://github.com/kodxana/lbry-sdk-ng/pull/31). The startup screen
shows saved history entries as well as header progress, and saved batches reset
its stalled-progress timer. A changing total is not shown as an overall percentage.

After account import, the normal balance poll also reads SDK status. The wallet
card marks its balance as provisional while discovery/history work is pending;
an apparent zero does not show the empty-wallet introduction until sync completes.
The header shows a wallet-sync label instead of an unfinished balance. Missing
status, a disconnected hub or incomplete work cannot be presented as completion.
The notice uses the existing card/help styles and has no animated indicator.

Focused renderer and polling tests cover growing history, incomplete and
disconnected states, older SDK responses, zero balances, repeated unchanged
balances, malformed counts, API failures and concurrent polls. These changes
use the RC2 SDK pin, which includes PR #31 in addition to the existing startup
fixes. The published desktop RC1 and its bundled SDK do not include this feature.

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
