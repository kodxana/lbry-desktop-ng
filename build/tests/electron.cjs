/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, ipcMain, session } = require('electron');
const remote = require('@electron/remote/main');

const output = path.resolve(__dirname, '../../dist/renderer-tests');
const root = fs.mkdtempSync(path.join(output, 'profile-'));
app.setPath('userData', root);
app.disableHardwareAcceleration();
remote.initialize();
app.on('window-all-closed', () => {});
const timer = setTimeout(() => {
  console.error('Renderer regression tests timed out');
  app.exit(1);
}, 90000);

async function run(phase) {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      plugins: true,
    },
  });
  remote.enable(window.webContents);
  try {
    await new Promise((resolve, reject) => {
      ipcMain.once('regression-result', (event, result) => {
        try {
          assert.equal(event.sender, window.webContents);
          assert.equal(result.phase, phase);
          if (result.error) throw new Error(result.error);
          console.log('PASS: ' + result.message);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      window.webContents.once('render-process-gone', (_event, details) => reject(new Error(JSON.stringify(details))));
      window.loadFile(path.join(output, 'index.html'), { query: { phase } }).catch(reject);
    });
  } finally {
    ipcMain.removeAllListeners('regression-result');
    window.destroy();
  }
}

app
  .whenReady()
  .then(async () => {
    require('./native.cjs')(root);
    const blocked = [];
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
      (details, callback) => {
        blocked.push(details.url);
        callback({ cancel: true });
      }
    );
    for (const phase of ['fresh', 'legacy', 'restart', 'documents', 'fileDialogs', 'wallet']) await run(phase);
    // The legacy analytics module eagerly loads this script even with analytics disabled.
    // Keep it blocked; any SDK or other service request is outside these tests' scope.
    assert.deepEqual(
      blocked.filter((url) => url !== 'https://analytics.lbry.com/matomo.js'),
      [],
      'Unexpected renderer requests: ' + JSON.stringify(blocked)
    );
    console.log('PASS: external requests blocked; no SDK calls; disposable IndexedDB profile');
    clearTimeout(timer);
    app.exit(0);
  })
  .catch((error) => {
    console.error(error);
    clearTimeout(timer);
    app.exit(1);
  });
