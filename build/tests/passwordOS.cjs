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
    if (phase === 'legacy-save') {
      // Produce the old desktop format with the real OS backend before testing the async reader.
      const ciphertext = safeStorage.encryptString(JSON.stringify({ kind: 'lbry-desktop-password', password: secret }));
      fs.writeFileSync(store.file, JSON.stringify({ version: 1, ciphertext: ciphertext.toString('base64') }), {
        mode: 0o600,
      });
    } else if (phase === 'save' || phase === 'migrate') {
      assert(await safeStorage.isAsyncEncryptionAvailable(), 'Real OS encryption must be available for this test');
      await store.save(secret, phase === 'migrate');
      assert(!fs.readFileSync(store.file).includes(Buffer.from('synthetic')), 'No plaintext in the protected record');
    } else if (phase === 'recover') {
      const record = await store.read();
      if (record.state === 'migration-unreadable')
        await store.save(secret, true); // Legacy copy is still present.
      else assert(record.password === secret, 'A persisted key can finish migration immediately');
    } else if (phase === 'restart') {
      const before = fs.readFileSync(store.file);
      assert((await store.read()).password === secret, 'Real OS encryption must round-trip across processes');
      assert.deepEqual(
        fs.readFileSync(store.file),
        before,
        'Reading an existing password must preserve its encrypted record'
      );
    } else if (phase === 'forget') {
      await store.forget();
    } else if (phase === 'forgotten') {
      assert.equal((await store.read()).state, 'forgotten');
    } else if (phase === 'unavailable') {
      await assert.rejects(() => store.save(secret), /unavailable/);
      assert.equal((await store.read()).state, 'forgotten', 'Insecure fallback must not replace the existing record');
    } else throw new Error('Unknown phase');
    assert(fs.existsSync(path.join(root, 'remembered-password.json')));
    console.log('PASS: native OS password storage: ' + phase);
    clearTimeout(timeout);
    if (phase === 'migrate')
      app.exit(0); // Simulate an immediate first-launch interruption.
    else app.quit();
  })
  .catch((error) => {
    console.error(error);
    clearTimeout(timeout);
    app.exit(1);
  });
