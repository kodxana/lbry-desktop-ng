/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { registerContentFiles } = require('../electron/contentFiles.cjs');
const { registerDesktopActions } = require('../electron/desktopActions.cjs');

async function main() {
  const output = path.resolve(__dirname, '../dist/content-tests');
  fs.mkdirSync(output, { recursive: true });
  const root = fs.mkdtempSync(path.join(output, 'files-'));
  const source = path.join(root, 'document ł #1.txt');
  const secret = path.join(root, 'private-wallet');
  fs.writeFileSync(source, 'Document ł');
  fs.writeFileSync(secret, 'synthetic private bytes');
  const frame = { url: 'file:///fixture/index.html' };
  const window = { isDestroyed: () => false, webContents: { isDestroyed: () => false, mainFrame: frame } };
  const event = { sender: window.webContents, senderFrame: frame };
  const handlers = {};
  const calls = [];
  const ipcMain = {
    handle: (name, fn) => {
      handlers[name] = fn;
    },
    on: (name, fn) => {
      handlers[name] = fn;
    },
  };
  let downloaded = [];
  let release;
  let hold = false;
  const files = registerContentFiles({
    ipcMain,
    profile: { temp: root },
    getWindow: () => window,
    rendererURL: frame.url,
    shell: { openPath: (file) => calls.push(['open', file]), showItemInFolder: (file) => calls.push(['reveal', file]) },
    probe: async () => {
      throw new Error('Not media');
    },
    rpc: async (method, params) => {
      assert.equal(method, 'file_list');
      assert.equal(params.page_size, 1);
      if (hold)
        await new Promise((resolve) => {
          release = resolve;
        });
      return { items: downloaded.map((download_path) => ({ download_path })) };
    },
  });
  const invoke = (name, value, sender = event) => handlers[name](sender, value);
  for (const file of [secret, source, root, '../wallet']) await assert.rejects(invoke('read-document', file));
  downloaded = [source];
  assert.equal((await invoke('read-document', source)).toString(), 'Document ł');
  await assert.rejects(invoke('read-document', secret), /Unknown file/);
  downloaded = [];
  await files.grant(source);
  const details = await invoke('get-file-details-from-path', source);
  assert.equal(details.name, path.basename(source));
  assert.equal(details.size, Buffer.byteLength('Document ł'));
  assert.equal(details.buffer.toString(), 'Document ł');
  await invoke('reveal-content-file', source);
  assert.deepEqual(calls, [['reveal', source]]);
  const executable = path.join(root, 'program.exe');
  fs.writeFileSync(executable, 'synthetic executable');
  await files.grant(executable);
  assert.equal(typeof (await invoke('open-content-file', executable)), 'string');
  assert.equal(calls.length, 1, 'The renderer cannot launch an executable');
  await assert.rejects(
    invoke('read-document', source, { ...event, senderFrame: { url: frame.url } }),
    /Unknown renderer/
  );
  const post = await invoke('save-post', '# Post ł');
  assert.equal(path.basename(post), 'post.md');
  assert(post.startsWith(root + path.sep));
  assert.equal((await invoke('read-document', post)).toString(), '# Post ł');
  for (const invalid of [{ path: secret, text: 'overwrite' }, 'x'.repeat(16 * 1024 * 1024 + 1)]) {
    await assert.rejects(invoke('save-post', invalid));
  }
  assert.equal(fs.readFileSync(secret, 'utf8'), 'synthetic private bytes');
  hold = true;
  downloaded = [secret];
  const pending = invoke('read-document', secret);
  while (!release) await new Promise((resolve) => setTimeout(resolve, 1));
  frame.url = 'https://example.invalid';
  release();
  await assert.rejects(pending, /Renderer changed/);
  frame.url = 'file:///fixture/index.html';
  registerDesktopActions({
    ipcMain,
    getWindow: () => window,
    rendererURL: frame.url,
    profile: { logs: root, data: root },
    shell: { openExternal: (url) => calls.push(url), openPath: (file) => calls.push(file) },
    launcher: { isEnabled: () => true },
  });
  for (const url of ['file:///private', 'javascript:void(0)', 'data:text/plain,test']) {
    assert.throws(() => invoke('open-external', url));
  }
  invoke('open-external', 'https://example.invalid/');
  assert.equal(calls.pop(), 'https://example.invalid/');
  assert.throws(() => invoke('open-profile-folder', secret));
  assert.throws(() => invoke('auto-launch', 'constructor'));
  assert.equal(invoke('auto-launch', 'isEnabled'), true);
  console.log(
    'PASS: selected/SDK file authorization, document bytes, post destinations, stale senders and scoped desktop actions'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
