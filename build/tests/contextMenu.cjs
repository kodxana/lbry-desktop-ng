const assert = require('assert').strict;
const { ipcMain, Menu, clipboard } = require('electron');
const { registerContextMenu } = require('../../electron/contextMenu.cjs');

module.exports = (getWindow, rendererURL) => {
  // Only disposable CI runners may replace the system clipboard. Local runs
  // exercise the same IPC and native Menu, intercepting clipboard operations.
  const nativeClipboard = process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_ENVIRONMENT === 'github-hosted';
  let menu;
  let dismiss;
  let requests = 0;
  const commands = [];
  registerContextMenu({
    ipcMain,
    getWindow,
    rendererURL,
    isDev: false,
    clipboard: nativeClipboard ? clipboard : { readText: async () => 'Synthetic paste ł' },
    Menu: {
      buildFromTemplate: (template) => {
        requests++;
        menu = Menu.buildFromTemplate(template);
        // Build actual native MenuItems but select/dismiss deterministically.
        // This avoids opening menus over the user's desktop during local runs.
        menu.popup = ({ window, callback }) => {
          assert.equal(window, getWindow());
          dismiss = callback;
        };
        menu.closePopup = () => dismiss();
        return menu;
      },
    },
  });
  ipcMain.handle('fixture-context-menu', async (_event, command, value) => {
    if (command === 'configure') {
      // Hidden windows do not receive OS focus. Give Chromium an active document
      // so CodeMirror receives real DOM focus events and prepares its selection.
      const debuggerApi = getWindow().webContents.debugger;
      debuggerApi.attach('1.3');
      await debuggerApi.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true });
      for (const name of ['copy', 'cut', 'paste']) {
        const contents = getWindow().webContents;
        const original = contents[name].bind(contents);
        contents[name] = () => {
          commands.push(name);
          if (nativeClipboard) original();
        };
      }
      if (nativeClipboard) await clipboard.writeText('Synthetic paste ł');
    } else if (command === 'choose') {
      const item = menu.getMenuItemById(value);
      assert(item && item.enabled, 'Selected menu item must exist and be enabled: ' + value);
      dismiss();
      item.click({}, getWindow(), getWindow().webContents);
    } else if (command === 'dismiss') dismiss();
    else if (command === 'paste-fixture' && nativeClipboard) await clipboard.writeText('Synthetic paste ł');
    return {
      nativeClipboard,
      clipboard: nativeClipboard ? await clipboard.readText() : null,
      commands,
      requests,
      items: menu ? menu.items.map(({ id, label, enabled, type }) => ({ id, label, enabled, type })) : [],
    };
  });
};
