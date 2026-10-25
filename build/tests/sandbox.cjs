/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const AdmZip = require('adm-zip');
const docxFixture = require('./fixtures/docx.cjs');
const { app, BrowserWindow, ipcMain } = require('electron');
const { registerWalletBackup } = require('../../electron/walletBackup.cjs');
const { registerPasswordStorage } = require('../../electron/passwordStorage.cjs');
const { registerUpdaterIpc } = require('../../electron/updaterIpc.cjs');
const { registerContentFiles } = require('../../electron/contentFiles.cjs');
const { updaterFixture } = require('./updaterFixture.cjs');

const output = path.resolve(__dirname, '../../dist/renderer-tests');
const root = fs.mkdtempSync(path.join(output, 'sandbox-'));
fs.mkdirSync(path.join(root, 'webworkers'));
for (const name of ['worker-bundle.js', 'libarchive.wasm'])
  fs.copyFileSync(path.join(output, 'webworkers', name), path.join(root, 'webworkers', name));
app.setPath('userData', root);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.on('window-all-closed', () => {});
const page = path.join(root, 'index.html');
fs.writeFileSync(
  page,
  '<!doctype html><meta charset="utf-8"><input type="file"><iframe src="about:blank"></iframe>' +
    '<script src="' +
    pathToFileURL(path.join(output, 'sandbox-dependencies.js')).href +
    '"></script>'
);
const rendererURL = pathToFileURL(page).href;
let window;
const timer = setTimeout(() => {
  console.error('Sandbox tests timed out');
  app.exit(1);
}, 30000);
const evaluate = (source) => window.webContents.executeJavaScript(source);
const call = (method, ...args) => evaluate('window.lbryDesktop.' + method + '(...' + JSON.stringify(args) + ')');
const until = async (condition) => {
  for (let i = 0; i < 200; i++) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Sandbox condition timed out');
};

app
  .whenReady()
  .then(async () => {
    const wallet = path.join(root, 'wallet ł');
    const downloads = path.join(root, 'downloads');
    fs.mkdirSync(wallet);
    fs.mkdirSync(downloads);
    const bytes = Buffer.from('{"encrypted":"synthetic wallet bytes"}');
    fs.writeFileSync(path.join(wallet, 'default_wallet'), bytes);
    const options = { ipcMain, getWindow: () => window, rendererURL };
    const revealed = [];
    registerWalletBackup({
      ...options,
      app: { getPath: () => downloads },
      shell: { showItemInFolder: (file) => revealed.push(file) },
      rpc: async () => ({ wallet_dir: wallet }),
    });
    const backend = require('./passwordBackend.cjs')();
    const passwords = registerPasswordStorage({
      ...options,
      safeStorage: backend,
      directory: root,
      cookies: { get: async () => [] },
      dialog: {},
      domains: [],
    });
    const updater = updaterFixture();
    registerUpdaterIpc({ ...options, updates: updater.updates });
    const files = registerContentFiles({
      ...options,
      profile: { temp: root },
      shell: {},
      rpc: async () => ({ items: [] }),
      probe: async () => {
        throw new Error('Not media');
      },
    });
    async function launch() {
      window = new BrowserWindow({
        show: false,
        webPreferences: {
          preload: path.join(output, 'preload.js'),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          additionalArguments: ['--lbry-renderer-url=' + rendererURL],
        },
      });
      await window.loadURL(rendererURL);
    }
    await launch();
    assert.deepEqual(
      await evaluate(`({ require: typeof require, process: typeof process, Buffer: typeof Buffer,
    sandboxed: window.lbryDesktop.sandboxed, frozen: Object.isFrozen(window.lbryDesktop),
    frame: typeof document.querySelector('iframe').contentWindow.lbryDesktop })`),
      {
        require: 'undefined',
        process: 'undefined',
        Buffer: 'undefined',
        sandboxed: true,
        frozen: true,
        frame: 'undefined',
      }
    );
    for (const key of ['send', 'invoke', 'ipcRenderer', 'require', 'fs']) {
      assert.equal(await evaluate('typeof window.lbryDesktop[' + JSON.stringify(key) + ']'), 'undefined');
    }
    assert.equal(await evaluate("window.lbryDesktop.filePath(new File(['text'], 'virtual.txt'))"), '');
    await assert.rejects(evaluate("window.lbryDesktop.filePath({ path: 'private-wallet' })"));
    await assert.rejects(call('readDocument', path.join(wallet, 'default_wallet')));
    const selected = path.join(root, 'selected ł #1.txt');
    fs.writeFileSync(selected, 'Selected document');
    const debug = window.webContents.debugger;
    debug.attach('1.3');
    try {
      const { root: document } = await debug.sendCommand('DOM.getDocument');
      const { nodeId } = await debug.sendCommand('DOM.querySelector', { nodeId: document.nodeId, selector: 'input' });
      await debug.sendCommand('DOM.setFileInputFiles', { nodeId, files: [selected] });
    } finally {
      debug.detach();
    }
    assert.equal(await evaluate("window.lbryDesktop.filePath(document.querySelector('input').files[0])"), selected);
    const contents = await call('readDocument', selected);
    assert.equal(Buffer.from(contents).toString(), 'Selected document');
    const docx = path.join(root, 'sandbox.docx');
    docxFixture().writeZip(docx);
    await files.grant(docx);
    const model = path.join(root, 'model ł #1.stl');
    fs.writeFileSync(
      model,
      'solid triangle\nfacet normal 0 0 1\nouter loop\nvertex -1 -1 0\nvertex 1 -1 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid triangle'
    );
    await files.grant(model);
    assert.deepEqual(await evaluate('window.probeThree(' + JSON.stringify(model) + ')'), {
      node: 'undefined',
      webgl2: true,
      triangles: 1,
      vertices: 3,
    });
    console.log('PASS: sandboxed Three.js loads authorized model bytes and renders with WebGL 2 without Node globals');
    const media = await require('./mediaServer.cjs')();
    try {
      for (const [file, format] of [
        ['sample.mp4', 'mp4'],
        ['master.m3u8', 'hls'],
        ['manifest.mpd', 'dash'],
      ]) {
        const result = await evaluate(
          'window.probeMedia(' + JSON.stringify(media.origin + '/' + file) + ',' + JSON.stringify(format) + ')'
        );
        assert.equal(result.node, 'undefined');
        assert(
          result.time >= 0.1 && result.frames > 0,
          format + ' must advance and decode video frames in the sandbox'
        );
        assert([32, 64].includes(result.height));
        if (format !== 'mp4')
          assert(result.source.startsWith('blob:'), 'Adaptive media uses MediaSource in the sandbox');
      }
      console.log('PASS: sandboxed Video.js 10 MP4, HLS and DASH adapters decode and play without Node globals');
    } finally {
      await media.close();
    }
    const comic = path.join(root, 'comic.cbz');
    const comicZip = new AdmZip();
    comicZip.addFile('1.png', Buffer.from(docxFixture.png, 'base64'));
    comicZip.writeZip(comic);
    await files.grant(comic);
    assert.deepEqual(await evaluate('window.probeComic(' + JSON.stringify(comic) + ')'), {
      pages: 1,
      width: 1,
      node: 'undefined',
    });
    console.log('PASS: sandboxed comic archive worker decodes an authorized CBZ and image without Node globals');
    const documents = await evaluate('window.probeDependencies(' + JSON.stringify(docx) + ')');
    const utilities = documents.utilities;
    assert.equal(utilities.signatures.length, 5);
    for (const { message, key, signature } of utilities.signatures) {
      assert.equal(signature, require('crypto').createHmac('sha256', key).update(message).digest('base64'));
    }
    assert.equal(utilities.signatures[0].signature, 'sDRMYdjbOFNcqK/OrwvxK4gdwgDJgz2nJuk3bC4yz/c=');
    assert.equal(utilities.signatures[1].signature, 'W9zBRr9gdU5qBCQmCJV1x1oAPwidJzmDnexYuWTsOEM=');
    console.log('PASS: sandboxed Web Crypto HMAC matches RFC 4231 and Node for Unicode, empty messages and long keys');
    const expectedBytes = [0, 1, 127, 128, 254, 255];
    assert.equal(utilities.encoded, Buffer.from(expectedBytes).toString('base64'));
    assert.deepEqual(utilities.decoded, expectedBytes, 'Buffer views must preserve offsets and binary bytes');
    assert.equal(utilities.utf8, 'LBRY ł 🐦\0');
    assert.equal(utilities.streamed, utilities.utf8, 'Streaming must preserve split UTF-8 characters');
    assert.equal(utilities.streamError, 'Fixture stream failure');
    assert.deepEqual(utilities.inheritance, { value: 'inherited', parent: true, constructor: true });
    assert.deepEqual(utilities.assertion, { recognized: true, actual: 1, expected: 2 });
    assert.deepEqual(utilities.url, {
      auth: 'user:pass',
      hostname: 'example.org',
      port: '8443',
      pathname: '/a%20b',
      query: 'q=hello',
      hash: '#frag',
    });
    assert.equal(utilities.ids.length, 64);
    assert.equal(new Set(utilities.ids).size, 64);
    for (const id of utilities.ids)
      assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    console.log(
      'PASS: browser Buffer offsets/base64/UTF-8, split streams/errors, inheritance, assertions, URLs and UUID v4 without Node globals'
    );
    assert.equal(
      await evaluate('typeof regeneratorRuntime.wrap'),
      'function',
      'Legacy generators retain their runtime'
    );
    assert(documents.legacyCookie.includes('auth_token=fixture-auth-token'));
    assert(!documents.legacyCookie.includes('expired='));
    assert(documents.persistedCookie.includes('sandbox_cookie=roundtrip-%20=value'));
    assert(documents.persistedCookie.includes('saved_password=fixture-%20=value'));
    assert(documents.mappedCookie.includes('old_path=preserve-path'));
    assert.equal(documents.mappedCookiePath, '/C:/Users/fixture/LBRY%20Desktop%20NG/resources/app.asar');
    console.log(
      'PASS: modern cookie library reads legacy storage and persists new cookies without renderer Node globals'
    );
    assert(documents.markdown.includes('<h1>Sandbox ł</h1>'));
    assert(documents.markdown.includes('<strong>Bold</strong>'));
    assert(documents.document.includes('<h1>Document fixture ł</h1>'));
    assert(documents.document.includes('data:image/png;base64,' + docxFixture.png));
    assert(documents.document.includes('Footnote text'));
    assert(documents.document.includes('Moved revision'));
    assert(!documents.document.includes('Old revision'));
    assert(!documents.document.includes('javascript:'));
    assert(!documents.document.includes('linked.png'));
    assert(!documents.document.includes('remote.png'));
    assert.equal(documents.streamed, 'Browser stream ł');
    assert.equal(documents.deprecated, 'supported');
    const backup = await call('backupWallet', { id: 'sandbox-backup', directory: wallet });
    assert.equal(backup.ok, true);
    assert.deepEqual(new AdmZip(backup.path).readFile('default_wallet'), bytes);
    assert.deepEqual(fs.readFileSync(path.join(wallet, 'default_wallet')), bytes);
    assert.deepEqual(revealed, [backup.path]);
    assert.equal((await call('backupWallet', { id: 'invalid-source', directory: root })).error, 'wallet');
    const password = 'sandbox-fixture-password ł';
    assert.equal((await call('password', 'save', password)).ok, true);
    assert(!fs.readFileSync(passwords.file, 'utf8').includes(password), 'Never write the plaintext password');
    window.destroy();
    await launch();
    assert.equal((await call('password', 'read')).password, password);
    backend.available = false;
    const savedBytes = fs.readFileSync(passwords.file);
    assert.equal((await call('password', 'save', 'replacement')).ok, false);
    assert.deepEqual(fs.readFileSync(passwords.file), savedBytes, 'Storage failure must preserve the saved password');
    backend.available = true;
    assert.equal((await call('password', 'read')).password, password);
    assert.equal((await call('password', 'forget')).ok, true);
    assert.deepEqual(JSON.parse(fs.readFileSync(passwords.file, 'utf8')), { version: 1, forgotten: true });
    assert.equal((await call('password', 'read')).state, 'forgotten');

    await evaluate(`window.updates = []; window.stopUpdates = window.lbryDesktop.onUpdater((...args) => {
    window.updates.push(args);
  }); true`);
    assert.equal((await call('updater', 'check', { autoDownload: false, allowPrerelease: true })).ok, true);
    const accepted = call('updater', 'accept');
    await until(() => updater.calls.downloads === 1);
    assert.equal(updater.calls.downloads, 1);
    await call('updater', 'decline');
    updater.completeDownload();
    await accepted;
    await until(async () => (await call('updater', 'state')).state.state === 'downloaded');
    assert.equal(updater.calls.stops, 0, 'Declining must not stop the SDK or install');
    assert(
      await evaluate('window.updates.length > 0 && window.updates.every(args => args.length === 1 && !args[0].sender)'),
      'Callbacks must receive only state, never Electron events'
    );
    await evaluate('window.stopUpdates(); window.updates.length = 0');
    const install = call('updater', 'accept');
    await until(() => updater.calls.stops === 1);
    assert.equal(updater.calls.stops, 1);
    assert.equal(updater.calls.installs, 0, 'Wait for the SDK before handing off the installer');
    updater.stop.resolve();
    await install;
    await until(() => updater.calls.installs === 1);
    assert.equal(await evaluate('window.updates.length'), 0, 'Disposed preload listeners must stop delivering events');
    await window.loadURL('data:text/html,<p>Another origin</p>');
    assert.equal(await evaluate('typeof window.lbryDesktop'), 'undefined');
    window.destroy();
    console.log(
      'PASS: sandboxed production preload, no Node/IPC or child-frame bridge, native File grants, ZIP bytes, password restart/failure/forget and updater decline/shutdown'
    );
    clearTimeout(timer);
    app.exit(0);
  })
  .catch((error) => {
    console.error(error);
    clearTimeout(timer);
    app.exit(1);
  });
