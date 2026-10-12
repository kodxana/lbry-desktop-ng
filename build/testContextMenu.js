/* eslint no-console:0 */
const assert = require('assert').strict;
const { EventEmitter } = require('events');
const { registerContextMenu } = require('../electron/contextMenu.cjs');
const request = { kind: 'text', x: 23, y: 41, hasText: true, hasSelection: true, editable: true };

function fixture(isDev = false) {
  const contents = new EventEmitter();
  contents.mainFrame = { url: 'file:///fixture/index.html#/publish' };
  contents.isDestroyed = () => false;
  const window = { webContents: contents, isDestroyed: () => false };
  const event = { sender: contents, senderFrame: contents.mainFrame };
  const f = { window, event, current: window, calls: [], menus: [], clipboard: 'Synthetic paste' };
  for (const command of ['copy', 'cut', 'paste', 'selectAll', 'inspectElement']) {
    contents[command] = (...args) => f.calls.push([command, ...args]);
  }
  registerContextMenu({
    ipcMain: {
      handle: (_channel, handler) => (f.invoke = (value = request, sender = event) => handler(sender, value)),
    },
    Menu: {
      buildFromTemplate: (items) => {
        if (f.failBuild) throw new Error('Synthetic menu build failure');
        const menu = {
          items,
          popup: (options) => {
            assert.equal(options.window, window);
            if (f.failPopup) throw new Error('Synthetic popup failure');
            menu.dismiss = options.callback;
          },
          closePopup: () => {
            f.closed = true;
            menu.dismiss();
          },
        };
        f.menus.push(menu);
        return menu;
      },
    },
    clipboard: { readText: () => f.clipboard },
    getWindow: () => f.current,
    rendererURL: 'file:///fixture/index.html',
    isDev,
  });
  f.menu = () => f.menus[f.menus.length - 1];
  f.click = (id) =>
    f
      .menu()
      .items.find((item) => item.id === id)
      .click();
  f.clean = () => {
    assert.equal(contents.listenerCount('did-start-navigation'), 0);
    assert.equal(contents.listenerCount('destroyed'), 0);
  };
  return f;
}

async function run() {
  for (const [id, command] of [
    ['copy', 'copy'],
    ['cut', 'cut'],
    ['paste', 'paste'],
    ['select-all', 'selectAll'],
  ]) {
    const f = fixture();
    const pending = f.invoke();
    assert(!f.menu().items.some((item) => item.id === 'inspect'));
    f.click(id);
    f.click(id);
    assert.deepEqual(await pending, { ok: true, action: null });
    assert.deepEqual(f.calls, [[command]], 'A selection must execute only once');
    f.menu().dismiss();
    f.clean();
  }
  for (const value of [
    { ...request, editable: false },
    { kind: 'snippet', x: 0, y: 0, hasText: true, hasSelection: true },
  ]) {
    const f = fixture();
    const pending = f.invoke(value);
    assert(!f.menu().items.some((item) => ['cut', 'paste'].includes(item.id)));
    f.menu().dismiss();
    assert.deepEqual(await pending, { ok: true, action: null });
    assert.deepEqual(f.calls, []);
    f.clean();
  }
  const empty = fixture();
  empty.clipboard = '';
  const emptyMenu = empty.invoke({ ...request, hasSelection: false, hasText: false });
  assert.deepEqual(
    empty.menu().items.map(({ id, enabled }) => ({ id, enabled })),
    [{ id: 'copy', enabled: false }]
  );
  empty.click('copy');
  empty.menu().dismiss();
  await emptyMenu;
  assert.deepEqual(empty.calls, []);

  const editor = fixture();
  const select = editor.invoke({ kind: 'editor', x: 0, y: 0, hasText: true, hasSelection: true });
  editor.menu().dismiss();
  editor.click('editor-select-all');
  assert.deepEqual(await select, { ok: true, action: 'editor-select-all' }, 'Closing must not swallow the click');
  for (const action of ['copy-link', 'report']) {
    const claim = fixture();
    const pending = claim.invoke({ kind: 'claim', hasClaim: true, x: 0, y: 0 });
    claim.click(action);
    assert.deepEqual(await pending, { ok: true, action });
  }
  const noClaim = fixture();
  assert.deepEqual(await noClaim.invoke({ kind: 'claim', hasClaim: false, x: 0, y: 0 }), { ok: true, action: null });
  assert.equal(noClaim.menus.length, 0);

  const dev = fixture(true);
  const inspect = dev.invoke();
  dev.click('inspect');
  await inspect;
  assert.deepEqual(dev.calls, [['inspectElement', 23, 41]], 'Inspect uses content coordinates, not screen coordinates');

  const invalid = fixture();
  for (const value of [
    null,
    [],
    {},
    'copy',
    { ...request, x: -1 },
    { ...request, y: NaN },
    { ...request, x: 1.5 },
    { ...request, kind: 'quit' },
    { ...request, editable: 'true' },
    { ...request, items: [] },
    { ...request, role: 'quit' },
    { kind: 'claim', x: 0, y: 0 },
  ]) {
    assert.deepEqual(await invalid.invoke(value), { ok: false, error: 'invalid' });
  }
  assert.equal(invalid.menus.length, 0);
  for (const change of [
    (f) => (f.current = null),
    (f) => (f.window.isDestroyed = () => true),
    (f) => (f.event.sender = {}),
    (f) => (f.event.senderFrame = { url: f.event.senderFrame.url }),
    (f) => (f.event.senderFrame = null),
    (f) => (f.event.senderFrame.url = 'https://example.invalid'),
  ]) {
    const f = fixture();
    change(f);
    assert.deepEqual(await f.invoke(), { ok: false, error: 'sender' });
    assert.equal(f.menus.length, 0);
  }
  for (const change of [
    (f) => (f.current = { ...f.window }),
    (f) => (f.event.senderFrame.url = 'https://example.invalid'),
    (f) => (f.window.webContents.mainFrame = {}),
    (f) => f.window.webContents.emit('did-start-navigation', {}, 'file:///fixture/index.html#/wallet', true, true),
    (f) => f.window.webContents.emit('destroyed'),
  ]) {
    const f = fixture();
    const pending = f.invoke();
    change(f);
    f.click('cut');
    assert.deepEqual(await pending, { ok: false, error: 'sender' });
    assert.deepEqual(f.calls, []);
    f.clean();
  }
  const busy = fixture();
  const first = busy.invoke();
  assert.deepEqual(await busy.invoke(), { ok: false, error: 'busy' });
  busy.window.webContents.emit('did-start-navigation', {}, 'about:blank', false, false);
  assert.equal(busy.closed, undefined, 'Subframe navigation must not dismiss the app menu');
  busy.menu().dismiss();
  await first;
  for (const failure of ['failBuild', 'failPopup']) {
    busy[failure] = true;
    assert.deepEqual(await busy.invoke(), { ok: false, error: 'menu' });
    busy[failure] = false;
    busy.clean();
  }
  const retry = busy.invoke();
  busy.click('copy');
  await retry;
  busy.clean();
  console.log(
    'PASS: context-menu commands, read-only state, development inspection, cancellation/retry and stale/sender checks'
  );
}

const timeout = setTimeout(() => {
  throw new Error('Context-menu tests timed out');
}, 10000);
run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => clearTimeout(timeout));
