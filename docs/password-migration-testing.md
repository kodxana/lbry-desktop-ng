# Testing remembered passwords in RC4

LBRY Desktop NG 0.54.0-rc.4 upgrades Electron and uses its asynchronous
OS-protected storage API. It reads the encrypted records created by RC3 and
still migrates older saved-password cookies. The SDK pin is unchanged from RC3.

## Before updating

Use a disposable NG wallet first. Keep a wallet backup and know its password:
a remembered password is not a backup. Close the older NG application and wait
for its SDK to stop before installing or launching RC4. Keep the same operating
system user and NG profile so there is a saved password to migrate. A fresh
profile only tests saving a new password.

Windows users can install the RC4 x64 installer over their existing NG install.
Linux users should extract the new tar.gz separately or launch the new AppImage;
both reuse the same NG profile. Do not run the old and new versions together.
The original LBRY Desktop and the separate LBRY SDK Test build have different
profiles and are not automatically imported.

Linux requires glibc 2.36 or newer (Ubuntu 24.04 is the tested baseline). To
remember passwords, it also needs a supported unlocked desktop keyring. If
secure storage is unavailable, manual password entry remains available and the
app reports that it could not remember the password. It does not use Linux's
hardcoded-key fallback. See [Linux startup instructions](linux-desktop.md).

## Upgrade and restart

1. In the older NG build, unlock a disposable encrypted wallet with Remember
   Password enabled, then close the app normally.
2. Launch RC4 using the same NG profile. Check that the remembered password
   still unlocks the wallet and that the receive address is unchanged. Allow
   wallet history to finish syncing before comparing balances.
3. Close RC4 normally and launch it again. Check that automatic unlock still
   works. When migrating a legacy cookie, its recovery copy is kept during the
   first launch. Successful decryption after this restart completes the migration
   and removes the old password cookie.
4. Use Forget Password in Settings, close the app, and reopen it. It should ask
   for the password again. Verify that manual unlock succeeds.
5. Remember the password again, then restart to check saving in the new format.
   Also try a successful unlock with Remember Password unchecked: the next
   launch should ask for the password.

If secure storage cannot be read, the app should report the problem and let you
enter the password manually. Conflicting legacy copies are not selected or
deleted automatically. Do not delete the profile or OS keyring to troubleshoot.

## Reporting results

Report the OS, previous NG version, RC4 package type, whether a keyring prompt
appeared, and which step passed or failed. Include the warning text if any, but
never share passwords, wallet files, cookies, account tokens or profile archives.

Windows and Linux CI cover synthetic legacy cookies, real OS storage across
process restarts, migration recovery and failures, Forget/opt-out/sign-out,
wallet encryption and backup restoration with disposable wallets, and packaged
startup/shutdown. Installed old-to-new upgrades and different Linux desktop
keyrings still need tester feedback. RC3 uses Electron 17;
RC4 uses the [Electron 45 migration](electron-runtime.md).
Its asynchronous OS storage API reads the same version-1 encrypted records;
ordinary reads do not rewrite them. The native tests also create a record with
the old synchronous API and verify it after a restart with the async reader.
Installed Windows CI covers the actual published RC3 upgrade with an unfunded
wallet, including recovery of the remembered password.
