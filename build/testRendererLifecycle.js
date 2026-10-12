/* eslint no-console:0 */
const assert = require('assert').strict;
const { EventEmitter } = require('events');
const { watchRenderer } = require('../electron/rendererLifecycle.cjs');
const flush = () => new Promise((resolve) => setImmediate(resolve));

function fixture() {
  const state = { prompts: [], errors: [], quits: 0, appState: {} };
  state.window = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    webContents: new EventEmitter(),
  });
  state.dialog = {
    showMessageBox: (_window, options) => {
      assert.equal(_window, state.window);
      state.prompts.push(options);
      return new Promise((resolve, reject) => {
        state.answer = (response) => resolve({ response });
        state.reject = reject;
      });
    },
    showErrorBox: (...args) => state.errors.push(args),
  };
  watchRenderer({
    window: state.window,
    app: { quit: () => state.quits++ },
    appState: state.appState,
    dialog: state.dialog,
    reportError: (...args) => state.errors.push(args),
  });
  state.gone = (reason) => state.window.webContents.emit('render-process-gone', {}, { reason });
  return state;
}

async function main() {
  for (const response of [0, 1]) {
    const f = fixture();
    f.window.emit('unresponsive');
    f.window.emit('unresponsive');
    assert.equal(f.prompts.length, 1, 'Only one dialog may be pending');
    assert.equal(f.prompts[0].defaultId, 0, 'Waiting must be the default');
    assert.equal(f.prompts[0].cancelId, 0, 'Closing the dialog must keep the app running');
    f.answer(response);
    await flush();
    assert.equal(f.quits, response, 'Only an explicit Quit enters normal app shutdown');
    f.window.emit('unresponsive');
    assert.equal(f.prompts.length, 2, 'A later hang can be reported again');
    f.answer(0);
    await flush();
  }
  const rejected = fixture();
  rejected.window.emit('unresponsive');
  rejected.reject(new Error('Synthetic dialog failure'));
  await flush();
  assert.equal(rejected.errors.length, 1);
  assert.equal(rejected.quits, 0, 'Dialog failure is not consent to quit');
  rejected.window.emit('unresponsive');
  assert.equal(rejected.prompts.length, 2);
  rejected.answer(0);
  await flush();

  for (const invalidate of [(f) => (f.appState.isQuitting = true), (f) => (f.window.isDestroyed = () => true)]) {
    const f = fixture();
    f.window.emit('unresponsive');
    invalidate(f);
    f.answer(1);
    await flush();
    f.window.emit('unresponsive');
    f.gone('crashed');
    assert.equal(f.quits, 0, 'Do not restart shutdown from a stale dialog or renderer event');
    assert.equal(f.prompts.length, 1);
    assert.equal(f.errors.length, 0);
  }
  const clean = fixture();
  clean.gone('clean-exit');
  assert.equal(clean.quits, 0);
  assert.equal(clean.errors.length, 0);

  for (const reason of ['crashed', 'killed', 'oom', 'launch-failed', 'abnormal-exit']) {
    const f = fixture();
    f.window.emit('unresponsive');
    f.gone(reason);
    f.gone(reason);
    f.answer(1);
    await flush();
    assert.equal(f.quits, 1, 'Renderer failure uses app.quit once, allowing SDK shutdown');
    assert.equal(f.errors.length, 1);
    assert.equal(f.window.isDestroyed(), false, 'Do not destroy the window before normal shutdown');
  }
  const brokenDialog = fixture();
  brokenDialog.dialog.showErrorBox = () => {
    throw new Error('Synthetic error box failure');
  };
  brokenDialog.gone('crashed');
  assert.equal(brokenDialog.errors.length, 1);
  assert.equal(brokenDialog.quits, 1, 'Even a failed crash notice must start SDK shutdown');
  console.log(
    'PASS: renderer failures, asynchronous Wait/Quit choices, duplicate and stale dialogs, normal quit lifecycle'
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
