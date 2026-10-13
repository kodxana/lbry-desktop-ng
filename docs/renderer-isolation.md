# Renderer isolation

The desktop renderer builds for a browser and runs with Node integration disabled,
context isolation enabled and the Chromium sandbox enabled. `electron/preload.cjs`
exposes the named methods in `desktopBridge.cjs` only for the application document
in the main frame. Child frames and navigation to another document receive no
bridge. Main-process services still validate the sending window, frame and URL.
Event subscriptions forward data only and return an unsubscribe function.
Legacy document dependencies use bundled browser implementations of Buffer,
streams and scheduling helpers. These have no access to the host environment or
filesystem and do not install Node globals on the page.

## Files and wallets

Wallet ZIP creation runs in the main process. The SDK supplies the source wallet
directory; the renderer's directory must match it. Archives preserve file bytes,
reject symbolic links, never overwrite an existing archive and remove a partial
file after a write failure. Cancellation while resolving the wallet, navigation
and window replacement discard the pending request. The existing Downloads,
home and wallet-parent destination fallbacks remain in place.

Document reads and file metadata are restricted to files selected through a
native dialog, disk-backed browser File objects, posts created by the app, or
download paths confirmed by the owned SDK. Native File paths are obtained inside
the preload with `webUtils`; renderer strings cannot grant access. Selecting a
directory does not grant access to its descendants. Documents are limited to
500 MB, and post writes to 16 MiB in a new directory inside the profile's temp
folder. Unknown file types and Unix executable files open in their folder rather
than being launched through the renderer's file API.

Password encryption and migration keep the existing main-process password store
and OS keyring. The cookie adapter's OS-specific file-URL mapping is calculated
in the main process to preserve existing cookie paths. Update acceptance, decline
and SDK shutdown remain owned by the existing updater service.

## Regression coverage

`node build/testRenderer.js` runs two complementary suites. The component suite
uses Node-enabled fixture windows to create documents and inspect backups, while
the application modules use the browser build and the production bridge factory.
The separate sandbox suite uses the production preload with Node disabled. It
checks missing Node/IPC globals, child-frame and navigation isolation, native File
selection across contextBridge, blocked arbitrary file reads, ZIP round trips,
password restart/failure/Forget and updater decline/shutdown ordering.
Markdown, DOCX conversion and stream operations also run with Node globals absent.

Packaged and development smoke tests assert sandbox flags and absent Node globals
while the real SDK syncs a disposable wallet against a fixture hub. Hosted Windows
CI performs actual RC3-to-candidate-to-candidate installations, checking wallet
keys, encryption, saved passwords, cookies, IndexedDB and clean SDK shutdown.
Native password tests also cover Windows DPAPI and an isolated Linux keyring.

This boundary removes direct renderer Node privileges. It does not redesign SDK
RPC authorization: the application still talks to its local wallet API. The file
protocol used for PDF and sandboxed HTML previews is unchanged. Treat RPC access,
content navigation and the broader dependency audit as separate security work.
