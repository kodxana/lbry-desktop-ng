const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { app, dialog, ipcMain } = require('electron');
const { registerFileSelection } = require('../../electron/fileSelection.cjs');

module.exports = function configureNativeFixtures(root, getWindow, rendererURL) {
  const downloads = path.join(root, 'fixture-downloads');
  fs.mkdirSync(downloads);
  app.setPath('downloads', downloads);
  let response;
  const dialogs = [];
  let release;
  let pending = false;
  dialog.showOpenDialog = async (window, options) => {
    assert.equal(window, getWindow(), 'The native dialog must belong to the active app window');
    assert(response, 'A dialog must have an explicit fixture response');
    dialogs.push(options);
    const next = response;
    response = null;
    for (const selected of next.filePaths || []) {
      assert(
        path.resolve(selected) === root || path.resolve(selected).startsWith(root + path.sep),
        'Only synthetic files may be read'
      );
    }
    if (next.hold) {
      pending = true;
      await new Promise((resolve) => {
        release = resolve;
      });
      pending = false;
    }
    if (next.error) throw new Error(next.error);
    return next;
  };
  registerFileSelection({ ipcMain, app, dialog, getWindow, rendererURL });
  ipcMain.handle('fixture-dialog-release', () => {
    assert(release, 'No held dialog to release');
    release();
    release = null;
  });
  ipcMain.handle('fixture-dialog', (_event, next) => {
    if (next !== undefined) response = next;
    return { dialogs, pending };
  });
  ipcMain.handle('fixture-file-input', async (event, selected) => {
    assert(path.resolve(selected).startsWith(root + path.sep));
    const debuggerApi = event.sender.debugger;
    debuggerApi.attach('1.3');
    try {
      const { root: document } = await debuggerApi.sendCommand('DOM.getDocument');
      const { nodeId } = await debuggerApi.sendCommand('DOM.querySelector', {
        nodeId: document.nodeId,
        selector: 'input[type=file]',
      });
      await debuggerApi.sendCommand('DOM.setFileInputFiles', { nodeId, files: [selected] });
    } finally {
      debuggerApi.detach();
    }
  });
};
