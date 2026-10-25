/* eslint no-console:0 */
const assert = require('assert').strict;
const { BrowserWindow } = require('electron');
const { watchRenderer } = require('../../electron/rendererLifecycle.cjs');

module.exports = async () => {
  const window = new BrowserWindow({ show: false });
  let quits = 0;
  let notices = 0;
  watchRenderer({
    window,
    app: { quit: () => quits++ },
    appState: {},
    dialog: { showErrorBox: () => notices++ },
  });
  try {
    await window.loadURL('data:text/html,<p>Disposable crash fixture</p>');
    await new Promise((resolve) => {
      window.webContents.once('render-process-gone', resolve);
      window.webContents.forcefullyCrashRenderer();
    });
    assert.equal(quits, 1, 'An actual renderer crash must reach the normal quit path');
    assert.equal(notices, 1);
    assert.equal(window.isDestroyed(), false);
  } finally {
    window.destroy();
  }
  console.log('PASS: actual Electron renderer crash reaches normal shutdown without losing the window');
};
