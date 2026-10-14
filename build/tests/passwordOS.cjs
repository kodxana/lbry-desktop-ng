/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { app, safeStorage, session } = require('electron');
const PasswordStore = require('../../electron/PasswordStore.cjs');

const [root, phase] = process.argv.slice(2);
const secret = 'synthetic OS password ;= ł 🔒\n';
app.setPath('userData', root);
app.disableHardwareAcceleration();
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('password-store', phase === 'unavailable' ? 'basic' : 'gnome-libsecret');
}
const timeout = setTimeout(() => app.exit(1), 45000);
app
  .whenReady()
  .then(async () => {
    // These Electron versions configure Linux OSCrypt when the network service starts.
    // The application gets this through its window; this windowless test must
    // initialize the same service before using safeStorage (no network request).
    await session.defaultSession.cookies.get({});
    const store = new PasswordStore(root, safeStorage);
    if (phase === 'save' || phase === 'migrate') {
      assert(safeStorage.isEncryptionAvailable(), 'Real OS encryption must be available for this test');
      store.save(secret, phase === 'migrate');
      assert(!fs.readFileSync(store.file).includes(Buffer.from('synthetic')), 'No plaintext in the protected record');
    } else if (phase === 'recover') {
      const record = store.read();
      if (record.state === 'migration-unreadable') store.save(secret, true); // Legacy copy is still present.
      else assert(record.password === secret, 'A persisted key can finish migration immediately');
    } else if (phase === 'restart') {
      assert(store.read().password === secret, 'Real OS encryption must round-trip across processes');
    } else if (phase === 'forget') {
      store.forget();
    } else if (phase === 'forgotten') {
      assert.equal(store.read().state, 'forgotten');
    } else if (phase === 'unavailable') {
      assert.equal(safeStorage.isEncryptionAvailable(), false, 'Electron must reject the Linux basic backend');
      assert.throws(() => store.save(secret));
      assert.equal(store.read().state, 'forgotten', 'Insecure fallback must not replace the existing record');
    } else throw new Error('Unknown phase');
    assert(fs.existsSync(path.join(root, 'remembered-password.json')));
    console.log('PASS: native OS password storage: ' + phase);
    clearTimeout(timeout);
    if (phase === 'migrate') app.exit(0); // Simulate an immediate first-launch interruption.
    else app.quit();
  })
  .catch((error) => {
    console.error(error);
    clearTimeout(timeout);
    app.exit(1);
  });
