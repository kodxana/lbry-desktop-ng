/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { registerContentFiles } = require('../electron/contentFiles.cjs');
const { registerDesktopActions } = require('../electron/desktopActions.cjs');
const mimeFixtures = require('./tests/fixtures/mime.json');

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
  let media;
  const files = registerContentFiles({
    ipcMain,
    profile: { temp: root },
    getWindow: () => window,
    rendererURL: frame.url,
    shell: { openPath: (file) => calls.push(['open', file]), showItemInFolder: (file) => calls.push(['reveal', file]) },
    probe: async () => {
      if (media) return media;
      throw new Error('Not media');
    },
    rpc: async (method, params) => {
      assert.equal(method, 'file_list');
      assert.equal(params.page_size, 1);
      if (hold) {
        await new Promise((resolve) => {
          release = resolve;
        });
      }
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
  assert.equal(details.mime, 'text/plain');
  for (const [name, type] of mimeFixtures) {
    const filename = path.join(root, name);
    fs.writeFileSync(filename, 'Synthetic content');
    // Downloads are authorized by the SDK, independently of picker grants.
    downloaded = [filename];
    const metadata = await invoke('get-file-details-from-path', filename);
    assert.equal(metadata.mime, type || undefined, name);
    assert.equal(metadata.duration, 0);
    assert.equal(metadata.buffer.toString(), 'Synthetic content');
    if (name === 'script.js') {
      assert.equal(await invoke('open-content-file', filename), 'Open this file from its folder.');
      assert.equal(calls.length, 0, 'Recognizing a script MIME type must not allow launching it');
    }
  }
  const mediaFile = downloaded[0];
  media = { format: { duration: 12.5, format_name: 'mov,mp4,m4a,3gp,3g2,mj2' } };
  const probed = await invoke('get-file-details-from-path', mediaFile);
  assert.equal(probed.mime, 'video/mp4', 'Media probing still overrides the filename type');
  assert.equal(probed.duration, 12.5);
  media = undefined;
  downloaded = [];
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
  // The pending RPC assigns release asynchronously.
  while (!release) await new Promise((resolve) => setTimeout(resolve, 1)); // eslint-disable-line no-unmodified-loop-condition
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
    'PASS: selected/SDK file authorization, MIME metadata and probe override, document bytes, post destinations, stale senders and scoped desktop actions'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
