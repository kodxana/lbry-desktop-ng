const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { app, dialog, ipcMain } = require('electron');
const { registerFileSelection } = require('../../electron/fileSelection.cjs');
const { registerContentFiles } = require('../../electron/contentFiles.cjs');

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
  const files = registerContentFiles({ ipcMain, getWindow, rendererURL,
    profile: { temp: root }, shell: {}, rpc: async () => ({ items: [] }),
    probe: async () => { throw new Error('Not media'); },
  });
  ipcMain.handle('fixture-grant-file', async (_event, file) => {
    assert(path.resolve(file).startsWith(root + path.sep));
    await files.grant(file);
  });
  registerFileSelection({ ipcMain, app, dialog, getWindow, rendererURL, onSelected: files.grant });
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
  ipcMain.handle('fixture-file-drop', async (event, files) => {
    assert.equal(event.sender, getWindow().webContents);
    for (const file of files) assert(path.resolve(file).startsWith(root + path.sep));
    const debuggerApi = event.sender.debugger;
    debuggerApi.attach('1.3');
    try {
      for (const type of ['dragEnter', 'dragOver', 'drop']) {
        await debuggerApi.sendCommand('Input.dispatchDragEvent', {
          type,
          x: 200,
          y: 200,
          data: { items: [], files, dragOperationsMask: 1 },
        });
      }
    } finally {
      debuggerApi.detach();
    }
  });
  ipcMain.handle('fixture-file-focus', async (event) => {
    assert.equal(event.sender, getWindow().webContents);
    const debuggerApi = event.sender.debugger;
    debuggerApi.attach('1.3');
    try {
      await debuggerApi.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true });
    } finally {
      debuggerApi.detach();
    }
  });
  ipcMain.handle('fixture-pdf-pixels', async (event) => {
    assert.equal(event.sender, getWindow().webContents);
    const snapshot = await event.sender.capturePage(undefined, { stayHidden: true, stayAwake: true });
    const pixels = snapshot.toBitmap();
    let green = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] < 40 && pixels[i + 1] > 210 && pixels[i + 2] < 40 && pixels[i + 3] > 240) green++;
    }
    if (green > 1000) fs.writeFileSync(path.join(root, '../../ci/pdf-preview.png'), snapshot.toPNG());
    return green;
  });
};
