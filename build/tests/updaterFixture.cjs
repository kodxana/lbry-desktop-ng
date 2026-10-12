const assert = require('assert').strict;
const { EventEmitter } = require('events');
const DesktopUpdater = require('../../electron/DesktopUpdater.cjs');
const { registerUpdaterIpc } = require('../../electron/updaterIpc.cjs');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function updaterFixture(enabled = true) {
  const library = new EventEmitter();
  const calls = { checks: 0, downloads: 0, stops: 0, installs: 0, errors: [] };
  const fixture = { calls, library, release: { version: '0.55.0' }, sdkStopped: false };
  library.setFeedURL = () => {};
  library.checkForUpdates = async () => {
    calls.checks++;
    if (fixture.checkGate) await fixture.checkGate.promise;
    library.emit('update-available', fixture.release);
  };
  library.downloadUpdate = () => {
    calls.downloads++;
    fixture.download = deferred();
    return fixture.download.promise;
  };
  library.quitAndInstall = (silent, restart) => {
    assert(fixture.sdkStopped, 'Installer must wait for successful SDK shutdown');
    assert.equal(silent, false);
    assert.equal(restart, true);
    calls.installs++;
  };
  fixture.updates = new DesktopUpdater(library, {
    enabled,
    version: '0.54.0-rc.3',
    stopSdk: () => {
      calls.stops++;
      fixture.stop = deferred();
      return fixture.stop.promise.then(() => {
        fixture.sdkStopped = true;
      });
    },
    onError: (error, installing) => calls.errors.push({ message: error.message, installing }),
  });
  fixture.completeDownload = () => {
    library.emit('update-downloaded', fixture.release);
    fixture.download.resolve();
  };
  fixture.failDownload = () => {
    const error = new Error('Synthetic interrupted download');
    library.emit('error', error);
    fixture.download.reject(error);
  };
  return fixture;
}

function ipcFixture(updates) {
  const handlers = new Map();
  const messages = [];
  const frame = { url: 'file:///fixture/index.html?phase=updater#/wallet' };
  const window = {
    isDestroyed: () => false,
    webContents: { isDestroyed: () => false, mainFrame: frame, send: (...args) => messages.push(args) },
  };
  const event = { sender: window.webContents, senderFrame: frame };
  const fixture = { window, event, current: window, messages };
  fixture.dispose = registerUpdaterIpc({
    updates,
    getWindow: () => fixture.current,
    rendererURL: 'file:///fixture/index.html',
    ipcMain: { handle: (name, fn) => handlers.set(name, fn), removeHandler: (name) => handlers.delete(name) },
  });
  fixture.invoke = (command, value) => handlers.get('desktop-updater')(event, command, value);
  return fixture;
}

module.exports = { deferred, updaterFixture, ipcFixture };
