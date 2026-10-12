const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { app, dialog, ipcMain } = require('electron');
const { getFileFromPath } = require('../../electron/fileSelection.cjs');

module.exports = function configureNativeFixtures(root) {
  const downloads = path.join(root, 'fixture-downloads');
  fs.mkdirSync(downloads);
  app.setPath('downloads', downloads);
  let response;
  const dialogs = [];
  const reads = [];
  dialog.showOpenDialog = async (options) => {
    assert(response, 'A dialog must have an explicit fixture response');
    dialogs.push(options);
    const next = response;
    response = null;
    if (next.error) throw new Error(next.error);
    return next;
  };
  ipcMain.handle('get-file-from-path', (event, selected, read) => {
    assert(
      path.resolve(selected) === root || path.resolve(selected).startsWith(root + path.sep),
      'Only synthetic files may be read'
    );
    reads.push({ selected, read });
    return getFileFromPath(event, selected, read);
  });
  ipcMain.handle('fixture-dialog', (_event, next) => {
    response = next;
    return { dialogs, reads };
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
