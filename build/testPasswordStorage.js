/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const PasswordStore = require('../electron/PasswordStore.cjs');
const { registerPasswordStorage } = require('../electron/passwordStorage.cjs');
const { createPasswordClient, legacyPasswordCookies } = require('../ui/util/password-storage.cjs');
const backend = require('./tests/passwordBackend.cjs');

const output = path.resolve(__dirname, '../dist/password-tests');
fs.mkdirSync(output, { recursive: true });
const directory = () => fs.mkdtempSync(path.join(output, 'fixture-'));
const secret = '  synthetic;= %2F ł 🔒 \n\u0000\ud800';
const equalSecret = (value) => assert(value === secret, 'Password bytes must round-trip unchanged');

function cookieFixture() {
  let raw = null;
  const storage = {
    getItem: () => raw,
    setItem: (_key, value) => {
      raw = value;
    },
  };
  const jar = new (require('tough-cookie').CookieJar)(new (require('tough-cookie-web-storage-store'))(storage));
  jar.setCookieSync('saved_password=legacy-%20=value; Path=/; Domain=lbry.tv; Secure', 'https://lbry.tv');
  jar.setCookieSync('auth_token=untouched; Path=/; Domain=lbry.tv; Secure', 'https://lbry.tv');
  jar.setCookieSync('saved_password=unrelated; Path=/', 'https://example.com');
  return { storage, jar, legacy: legacyPasswordCookies(storage, ['lbry.tv']) };
}

function service({ crypto = backend(), filesystem = fs, cookies = [], legacy = cookieFixture().legacy } = {}) {
  const root = directory();
  const notices = [];
  const frame = { url: 'file:///fixture/index.html#/wallet' };
  const window = { webContents: { mainFrame: frame } };
  let handler;
  const cookieApi = {
    get: async () => cookies,
    remove: async (url) => {
      cookies = cookies.filter((cookie) => new URL(url).hostname !== cookie.domain.replace(/^\./, ''));
    },
    flushStore: async () => {},
  };
  const registered = registerPasswordStorage({
    ipcMain: {
      handle: (_channel, callback) => {
        handler = callback;
      },
    },
    safeStorage: crypto,
    directory: root,
    getWindow: () => window,
    rendererURL: 'file:///fixture/index.html',
    cookies: cookieApi,
    dialog: { showMessageBox: async (_window, options) => notices.push(options) },
    domains: ['lbry.tv'],
  });
  registered.fs = filesystem;
  const invoke = (operation, value, event = { sender: window.webContents, senderFrame: frame }) =>
    handler(event, operation, value);
  return {
    root,
    store: registered,
    invoke,
    notices,
    window,
    frame,
    cookieApi,
    legacy,
    client: () => createPasswordClient(invoke, legacy),
  };
}

async function unitTests() {
  const root = directory();
  const crypto = backend();
  const store = new PasswordStore(root, crypto);
  assert.equal((await store.read()).state, 'missing');
  await store.save(secret);
  equalSecret((await new PasswordStore(root, crypto).read()).password);
  const bytes = fs.readFileSync(store.file);
  assert(!bytes.includes(Buffer.from('synthetic')), 'Disk record must not contain the password');
  if (process.platform !== 'win32') assert.equal(fs.statSync(store.file).mode & 0o777, 0o600);
  for (const method of ['openSync', 'writeFileSync', 'fsyncSync', 'renameSync']) {
    const broken = new PasswordStore(root, crypto, {
      ...fs,
      [method]: () => {
        throw new Error('Synthetic disk failure');
      },
    });
    await assert.rejects(() => broken.save('replacement'), 'Write failures must propagate');
    assert(fs.readFileSync(store.file).equals(bytes), 'A failed write must preserve the previous protected record');
    assert.equal(fs.readdirSync(root).length, 1, 'Temporary files must be removed after failure');
  }
  const brokenCrypto = {
    ...crypto,
    decryptStringAsync: () => {
      throw new Error('Synthetic decryption failure');
    },
  };
  await assert.rejects(() => new PasswordStore(root, brokenCrypto).save('replacement'));
  assert(fs.readFileSync(store.file).equals(bytes), 'Verification must finish before replacing the old record');
  crypto.available = false;
  await assert.rejects(() => store.save(secret));
  await assert.rejects(() => store.read());
  assert(fs.readFileSync(store.file).equals(bytes), 'Unavailable OS storage must preserve encrypted data');
  await store.forget();
  assert.equal((await store.read()).state, 'forgotten', 'Forgetting works while the keyring is locked');
  crypto.available = true;
  for (const value of ['{"version":9}', '{"version":1,"ciphertext":"broken!"}', '{']) {
    fs.writeFileSync(store.file, value);
    await assert.rejects(() => store.read());
    assert.equal(fs.readFileSync(store.file, 'utf8'), value, 'Never reset corrupt or future records on read');
  }
  const insecure = { ...backend(), encryptStringAsync: () => Buffer.from('v10-insecure') };
  await assert.rejects(() => new PasswordStore(directory(), insecure, fs, 'linux').save(secret));
  await assert.rejects(() =>
    new PasswordStore(
      directory(),
      { ...backend(), encryptStringAsync: async () => Buffer.from('v99-unknown') },
      fs,
      'linux'
    ).save(secret)
  );

  const fixture = cookieFixture();
  const svc = service({ legacy: fixture.legacy });
  const first = await svc.client().getSavedPasswordState();
  assert(
    first.password === 'legacy-%20=value' && first.remembered,
    'Migrate without URL-decoding or truncating equals signs'
  );
  assert(
    fixture.jar.getCookieStringSync('https://lbry.tv').includes('saved_password'),
    'Keep recovery copy until restart'
  );
  assert(await svc.client().setSavedPassword(first.password, true));
  assert.equal(
    (await svc.store.read()).pending,
    true,
    'Auto-unlock must not commit migration within the first process'
  );
  svc.store.migratedThisRun = false; // Simulate a new main process; OS tests also use actual process restarts.
  assert.equal(await svc.client().getSavedPassword(), first.password);
  assert(
    !fixture.jar.getCookieStringSync('https://lbry.tv').includes('saved_password'),
    'Remove the shim cookie after verification'
  );
  assert(
    fixture.jar.getCookieStringSync('https://lbry.tv').includes('auth_token=untouched'),
    'Preserve account tokens'
  );
  assert(
    fixture.jar.getCookieStringSync('https://example.com').includes('saved_password=unrelated'),
    'Preserve unrelated origins'
  );
  assert((await svc.client().getSavedPassword()) === first.password, 'A new client must load protected storage');
  assert.equal(svc.notices.length, 0);

  const interruptedMigration = service();
  assert.equal(await interruptedMigration.client().getSavedPassword(), first.password);
  interruptedMigration.store.crypto = backend(); // A crash lost the first process's new OS key.
  interruptedMigration.store.migratedThisRun = false;
  assert.equal(
    await interruptedMigration.client().getSavedPassword(),
    first.password,
    'Recover from the retained cookie'
  );
  assert.equal(interruptedMigration.legacy.read().length, 1, 'Recovery must retain the cookie until a good restart');
  interruptedMigration.store.migratedThisRun = false;
  assert.equal(await interruptedMigration.client().getSavedPassword(), first.password);
  assert.equal(interruptedMigration.legacy.read().length, 0, 'Only a successful restart may remove the old cookie');

  const variants = cookieFixture();
  const jar = JSON.parse(variants.storage.getItem());
  jar['.lbry.tv'] = { '/old': { saved_password: { key: 'saved_password', value: 'legacy-%20=value' } } };
  variants.storage.setItem('', JSON.stringify(jar));
  const duplicate = service({
    legacy: variants.legacy,
    cookies: [
      { name: 'saved_password', value: 'legacy-%20=value', domain: '.lbry.tv', path: '/', secure: true },
      { name: 'saved_password', value: 'other-site', domain: '.example.com', path: '/', secure: true },
    ],
  });
  assert.equal(await duplicate.client().getSavedPassword(), first.password);
  duplicate.store.migratedThisRun = false;
  await duplicate.client().getSavedPassword();
  assert.deepEqual(variants.legacy.read(), []);
  assert.equal((await duplicate.cookieApi.get()).length, 1, 'Remove native cookies only for LBRY origins');

  for (const failure of ['unavailable', 'write', 'verification', 'read-back', 'native-cleanup', 'shim-cleanup']) {
    const legacy = cookieFixture();
    const original = legacy.storage.getItem();
    const test = service({ legacy: legacy.legacy });
    if (failure.includes('cleanup')) await test.store.save(first.password);
    if (failure === 'unavailable') test.store.crypto.available = false;
    if (failure === 'write') {
      test.store.fs = {
        ...fs,
        renameSync: () => {
          throw new Error('Synthetic rename failure');
        },
      };
    }
    if (failure === 'verification') {
      test.store.crypto.decryptStringAsync = async () => ({
        result: '{"kind":"lbry-desktop-password","password":"wrong"}',
      });
    }
    if (failure === 'read-back') {
      test.store.fs = {
        ...fs,
        readFileSync: (file, ...args) => {
          if (file === test.store.file && fs.existsSync(file)) throw new Error('Synthetic final read failure');
          return fs.readFileSync(file, ...args);
        },
      };
    }
    if (failure === 'native-cleanup') {
      test.cookieApi.flushStore = async () => {
        throw new Error('Synthetic cookie failure');
      };
    }
    if (failure === 'shim-cleanup') {
      legacy.storage.setItem = () => {
        throw new Error('Synthetic quota failure');
      };
    }
    assert.equal(
      await test.client().getSavedPassword(),
      first.password,
      'Existing password remains usable after ' + failure
    );
    assert.equal(test.notices.length, 1, 'Explain migration failure: ' + failure);
    if (failure !== 'native-cleanup') {
      assert.equal(legacy.storage.getItem(), original, 'Keep the legacy source after ' + failure);
    }
    if (failure.includes('cleanup')) assert.equal((await test.store.read()).password, first.password);
  }

  const conflict = service({ cookies: [{ name: 'saved_password', value: 'different', domain: 'lbry.tv', path: '/' }] });
  assert.equal(await conflict.client().getSavedPassword(), null, 'Conflicting legacy passwords need manual entry');
  assert.equal((await conflict.store.read()).state, 'missing');
  assert.equal(conflict.legacy.read().length, 1, 'Do not erase conflicting legacy copies');
  assert.equal(conflict.notices.length, 1);

  const optOut = service();
  const client = optOut.client();
  await client.getSavedPassword();
  assert(await client.setSavedPassword(secret, true));
  equalSecret(await optOut.client().getSavedPassword());
  assert(await client.setSavedPassword(secret, false));
  equalSecret(await client.getSavedPassword());
  assert.equal((await client.getSavedPasswordState()).remembered, false);
  assert.equal(await optOut.client().getSavedPassword(), null, 'Opt-out must survive restart');
  assert(await client.deleteSavedPassword());
  assert.equal(await client.getSavedPassword(), null, 'Forget must clear the session cache');
  assert(await client.setSavedPassword('', true));
  assert.equal(await optOut.client().getSavedPassword(), null, 'An empty password must forget the previous copy');

  const interrupted = service();
  interrupted.legacy.clear = () => {
    throw new Error('Synthetic interrupted cleanup');
  };
  const forgetting = interrupted.client();
  assert.equal(
    await forgetting.deleteSavedPassword(),
    false,
    'Do not report successful removal after a cleanup failure'
  );
  assert.equal(await interrupted.client().getSavedPassword(), null, 'The durable marker prevents resurrection');
  assert.equal(interrupted.legacy.read().length, 1, 'Fixture must still contain the interrupted legacy cookie');

  const orphan = service();
  const temporary = orphan.store.file + '.0123456789abcdef01234567.tmp';
  const unrelated = path.join(orphan.root, 'unrelated.tmp');
  fs.writeFileSync(temporary, 'synthetic abandoned ciphertext');
  fs.writeFileSync(unrelated, 'unrelated');
  assert(await orphan.client().deleteSavedPassword());
  assert(!fs.existsSync(temporary), 'Forget must remove abandoned encrypted writes');
  assert(fs.existsSync(unrelated), 'Forget must leave unrelated files alone');

  const corrupt = service();
  fs.writeFileSync(corrupt.store.file, 'corrupt protected record');
  assert(await corrupt.client().hasSavedPassword(), 'An unreadable password must still be forgettable in settings');
  assert.equal(
    await corrupt.client().getSavedPassword(),
    null,
    'Never fall back to an older cookie if the protected record is unreadable'
  );
  assert.equal(corrupt.legacy.read().length, 1);
  assert.equal(fs.readFileSync(corrupt.store.file, 'utf8'), 'corrupt protected record');

  const concurrent = service();
  const active = concurrent.client();
  await Promise.all([active.getSavedPassword(), active.setSavedPassword(secret, true), active.deleteSavedPassword()]);
  assert.equal(await concurrent.client().getSavedPassword(), null, 'Concurrent calls must preserve invocation order');
  for (const event of [
    { sender: {}, senderFrame: concurrent.frame },
    { sender: concurrent.window.webContents, senderFrame: { url: concurrent.frame.url } },
  ]) {
    assert.equal((await concurrent.invoke('read', undefined, event)).ok, false, 'Reject other windows and subframes');
  }
  concurrent.frame.url = 'https://example.com/index.html';
  assert.equal((await concurrent.invoke('save', secret)).ok, false, 'Reject a navigated renderer');
  assert.equal((await concurrent.store.read()).state, 'forgotten');
  const delayed = service();
  let finishEncryption;
  const encrypt = delayed.store.crypto.encryptStringAsync.bind(delayed.store.crypto);
  delayed.store.crypto.encryptStringAsync = async (value) => {
    await new Promise((resolve) => {
      finishEncryption = resolve;
    });
    return encrypt(value);
  };
  const saving = delayed.invoke('save', secret);
  const forgettingAfterSave = delayed.invoke('forget');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(typeof finishEncryption, 'function');
  assert(!fs.existsSync(delayed.store.file), 'Do not write until asynchronous encryption finishes');
  finishEncryption();
  assert.equal((await saving).ok, true);
  assert.equal((await forgettingAfterSave).ok, true);
  assert.equal((await delayed.store.read()).state, 'forgotten', 'Queued Forget must win over a pending save');

  const portalCrypto = backend();
  const portalEncrypt = portalCrypto.encryptStringAsync.bind(portalCrypto);
  portalCrypto.encryptStringAsync = async (value) => {
    const bytes = await portalEncrypt(value);
    bytes.write('v12');
    return bytes;
  };
  const portal = new PasswordStore(directory(), portalCrypto, fs, 'linux');
  const portalBytes = await portalCrypto.encryptStringAsync(
    JSON.stringify({ kind: 'lbry-desktop-password', password: secret })
  );
  equalSecret((await portal.decode({ version: 1, ciphertext: portalBytes.toString('base64') })).password);
  console.log(
    'PASS: protected password writes, migration, failure preservation, opt-out, forget, serialization and IPC boundaries'
  );
}

function nativeTests() {
  const root = directory();
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  for (const phase of [
    'legacy-save',
    'restart',
    'migrate',
    'recover',
    'restart',
    'save',
    'restart',
    'forget',
    'forgotten',
    ...(process.platform === 'linux' ? ['unavailable'] : []),
  ]) {
    const result = spawnSync(require('electron'), [path.join(__dirname, 'tests/passwordOS.cjs'), root, phase], {
      env,
      encoding: 'utf8',
      timeout: 60000,
      windowsHide: true,
    });
    process.stdout.write((result.stdout || '') + (result.stderr || ''));
    if (result.error) throw result.error;
    assert.equal(
      result.status,
      0,
      'Native password test failed: ' + phase + (result.signal ? ' (' + result.signal + ')' : '')
    );
  }
}

if (process.argv.includes('--native')) nativeTests();
else {
  unitTests().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
