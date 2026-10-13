/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { registerFileSelection } = require('../electron/fileSelection.cjs');

const output = path.resolve(__dirname, '../dist/file-selection-tests');
fs.mkdirSync(output, { recursive: true });
const root = fs.mkdtempSync(path.join(output, 'fixture-'));
const selected = path.join(root, 'chosen ł #1.txt');
const contents = Buffer.from('Native picker fixture\nZażółć');
fs.writeFileSync(selected, contents);
const cancel = { canceled: true, filePaths: [selected] };
const selection = { canceled: false, filePaths: [selected] };
const request = { type: 'openFile' };

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function service(platform = 'win32') {
  const frame = { url: 'file:///fixture/index.html?test=true#/publish' };
  const window = { isDestroyed: () => false, webContents: { mainFrame: frame, isDestroyed: () => false } };
  const event = { sender: window.webContents, senderFrame: frame };
  const calls = [];
  let handler;
  const fixture = { window, event, calls, current: window, response: selection };
  registerFileSelection({
    ipcMain: {
      handle: (channel, callback) => {
        assert.equal(channel, 'select-file');
        handler = callback;
      },
    },
    getWindow: () => fixture.current,
    rendererURL: 'file:///fixture/index.html',
    app: {
      getPath: (name) => {
        assert.equal(name, 'home');
        return root;
      },
    },
    platform,
    dialog: {
      showOpenDialog: async (parent, options) => {
        assert.equal(parent, window);
        calls.push(options);
        if (fixture.response instanceof Error) throw fixture.response;
        return fixture.response;
      },
    },
  });
  fixture.invoke = (value = request, sender = event) => handler(sender, value);
  return fixture;
}

async function run() {
  const fixture = service();
  const filters = [
    { name: 'Text', extensions: ['txt'] },
    { name: 'All', extensions: ['*'] },
  ];
  const result = await fixture.invoke({ ...request, filters });
  assert.equal(result.ok, true);
  assert.equal(result.file.path, selected);
  assert.equal(result.file.name, path.basename(selected));
  assert.equal(result.file.mime, 'text/plain');
  assert.deepEqual(result.file.buffer, contents);
  assert.deepEqual(fixture.calls[0], { properties: ['openFile'], filters, defaultPath: root });
  const linux = service('linux');
  await linux.invoke();
  assert(!Object.hasOwn(linux.calls[0], 'defaultPath'), 'The first Linux picker uses the Electron default');
  const nested = path.join(root, 'another folder ł');
  fs.mkdirSync(nested);
  const nestedFile = path.join(nested, 'chosen.txt');
  fs.writeFileSync(nestedFile, 'Nested selection');
  linux.response = { canceled: false, filePaths: [nestedFile] };
  await linux.invoke();
  assert.equal(linux.calls[1].defaultPath, root);
  linux.response = cancel;
  await linux.invoke();
  assert.equal(linux.calls[2].defaultPath, nested);
  linux.response = new Error('Synthetic selection failure');
  await linux.invoke();
  assert.equal(linux.calls[3].defaultPath, nested, 'Cancel must preserve the previous directory');
  linux.response = { canceled: false, filePaths: [nested] };
  await linux.invoke({ type: 'openDirectory' });
  assert(!Object.hasOwn(linux.calls[4], 'defaultPath'), 'Folder selection has its own last directory');
  linux.response = cancel;
  await linux.invoke({ type: 'openDirectory' });
  assert.equal(linux.calls[5].defaultPath, nested);
  await linux.invoke();
  assert.equal(linux.calls[6].defaultPath, nested, 'A failed file selection must preserve the previous directory');

  // Cancellation and metadata-only selections must not read file contents.
  const readFile = fs.promises.readFile;
  const stat = fs.promises.stat;
  try {
    fs.promises.stat = async () => {
      throw new Error('Canceled dialogs must not stat a file');
    };
    fixture.response = cancel;
    assert.deepEqual(await fixture.invoke(), { ok: true, file: null });
    fixture.response = { canceled: false, filePaths: [] };
    assert.deepEqual(await fixture.invoke(), { ok: true, file: null });
    fs.promises.stat = stat;
    fs.promises.readFile = async () => {
      throw new Error('Metadata selection must not read contents');
    };
    fixture.response = selection;
    assert.equal((await fixture.invoke({ ...request, readFile: false })).file.buffer.byteLength, 0);
    fixture.response = { canceled: false, filePaths: [root] };
    const directory = await fixture.invoke({ type: 'openDirectory' });
    assert.equal(directory.file.path, root);
    assert.equal(directory.file.mime, undefined);
    assert.equal(directory.file.buffer.byteLength, 0);
    assert.deepEqual(fixture.calls[fixture.calls.length - 1].properties, ['openDirectory']);
  } finally {
    fs.promises.readFile = readFile;
    fs.promises.stat = stat;
  }

  const invalid = service();
  for (const payload of [
    null,
    [],
    'openFile',
    {},
    { type: 'saveFile' },
    { ...request, readFile: 'false' },
    { ...request, path: selected },
    { ...request, defaultPath: root },
    { ...request, properties: ['multiSelections'] },
    { ...request, filters: null },
    { ...request, filters: {} },
    { ...request, filters: [null] },
    { ...request, filters: [{ name: 'Text', extensions: [] }] },
    { ...request, filters: [{ name: 'Text', extensions: ['*.txt'] }] },
    { ...request, filters: [{ name: 1, extensions: ['txt'] }] },
  ]) {
    assert.deepEqual(await invalid.invoke(payload), { ok: false, error: 'invalid' });
  }
  assert.equal(invalid.calls.length, 0);

  for (const change of [
    (f) => {
      f.current = null;
    },
    (f) => {
      f.window.isDestroyed = () => true;
    },
    (f) => {
      f.window.webContents.isDestroyed = () => true;
    },
    (f) => {
      f.event.sender = {};
    },
    (f) => {
      f.event.senderFrame = { url: f.event.senderFrame.url };
    },
    (f) => {
      f.event.senderFrame = null;
    },
    (f) => {
      f.event.senderFrame.url = 'https://example.invalid/';
    },
    (f) => {
      f.event.senderFrame.url = 'not a URL';
    },
  ]) {
    const blocked = service();
    change(blocked);
    assert.deepEqual(await blocked.invoke(), { ok: false, error: 'sender' });
    assert.equal(blocked.calls.length, 0);
  }

  const busy = service();
  const held = deferred();
  busy.response = held.promise;
  const first = busy.invoke();
  assert.deepEqual(await busy.invoke(), { ok: false, error: 'busy' });
  assert.equal(busy.calls.length, 1);
  held.resolve(cancel);
  await first;
  busy.response = new Error('Synthetic dialog failure');
  assert.deepEqual(await busy.invoke(), { ok: false, error: 'selection' });
  busy.response = { canceled: false, filePaths: [path.join(root, 'removed-file')] };
  assert.deepEqual(await busy.invoke(), { ok: false, error: 'selection' });
  busy.response = selection;
  assert.equal((await busy.invoke()).ok, true, 'Errors and cancellation must release the pending dialog');

  for (const change of [
    (f) => {
      f.current = { ...f.window };
    },
    (f) => {
      f.window.isDestroyed = () => true;
    },
    (f) => {
      f.window.webContents.mainFrame = { url: f.event.senderFrame.url };
    },
    (f) => {
      f.event.senderFrame.url = 'https://example.invalid/';
    },
  ]) {
    const stale = service();
    const response = deferred();
    stale.response = response.promise;
    const pending = stale.invoke();
    change(stale);
    try {
      fs.promises.stat = async () => {
        throw new Error('Stale selections must not read files');
      };
      response.resolve(selection);
      assert.deepEqual(await pending, { ok: false, error: 'sender' });
    } finally {
      fs.promises.stat = stat;
    }
  }

  // Also recheck the sender after a slow disk read finishes.
  const stale = service();
  const reading = deferred();
  const bytes = deferred();
  try {
    fs.promises.readFile = () => {
      reading.resolve();
      return bytes.promise;
    };
    const pending = stale.invoke();
    await reading.promise;
    stale.event.senderFrame.url = 'https://example.invalid/';
    bytes.resolve(contents);
    assert.deepEqual(await pending, { ok: false, error: 'sender' });
  } finally {
    fs.promises.readFile = readFile;
  }
  console.log(
    'PASS: native file selection, metadata, cancellation/retry, request validation, sender checks and pending/stale dialogs'
  );
}

const timeout = setTimeout(() => {
  console.error('File selection tests timed out');
  process.exit(1);
}, 10000);
run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => clearTimeout(timeout));
