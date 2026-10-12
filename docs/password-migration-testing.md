# Testing remembered-password migration in RC3

LBRY Desktop NG 0.54.0-rc.3 replaces legacy saved-password cookies with
OS-protected storage. It also includes the wallet history progress changes
developed in the local RC2 builds. The SDK pin is unchanged from RC2.

## Before updating

Use a disposable NG wallet first. Keep a wallet backup and know its password:
a remembered password is not a backup. Close the older NG application and wait
for its SDK to stop before installing or launching RC3. Keep the same operating
system user and NG profile so there is a saved password to migrate. A fresh
profile only tests saving a new password.

Windows users can install the RC3 x64 installer over their existing NG install.
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
2. Launch RC3 using the same NG profile. Check that the remembered password
   still unlocks the wallet and that the receive address is unchanged. Allow
   wallet history to finish syncing before comparing balances.
3. Close RC3 normally and launch it again. Check that automatic unlock still
   works. Migration keeps the legacy recovery copy during the first launch;
   successful decryption after this restart completes the migration and removes
   the old password cookie.
4. Use Forget Password in Settings, close the app, and reopen it. It should ask
   for the password again. Verify that manual unlock succeeds.
5. Remember the password again, then restart to check saving in the new format.
   Also try a successful unlock with Remember Password unchecked: the next
   launch should ask for the password.

If secure storage cannot be read, the app should report the problem and let you
enter the password manually. Conflicting legacy copies are not selected or
deleted automatically. Do not delete the profile or OS keyring to troubleshoot.

## Reporting results

Report the OS, previous NG version, RC3 package type, whether a keyring prompt
appeared, and which step passed or failed. Include the warning text if any, but
never share passwords, wallet files, cookies, account tokens or profile archives.

Windows and Linux CI cover synthetic legacy cookies, real OS storage across
process restarts, migration recovery and failures, Forget/opt-out/sign-out,
wallet encryption and backup restoration with disposable wallets, and packaged
startup/shutdown. Installed old-to-new upgrades and different Linux desktop
keyrings still need tester feedback. Published RC3 builds retain Electron 17;
current source builds use the [Electron 22 compatibility checkpoint](electron-runtime.md).
