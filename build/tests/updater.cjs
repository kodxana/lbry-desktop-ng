const { ipcMain } = require('electron');
const { registerUpdaterIpc } = require('../../electron/updaterIpc.cjs');
const { updaterFixture, deferred } = require('./updaterFixture.cjs');

module.exports = function configureUpdaterFixtures(getWindow, rendererURL) {
  let fixture;
  let dispose;
  let holdSnapshot = false;
  let snapshotGate;
  let failDecline = false;
  const reset = () => {
    if (dispose) dispose();
    fixture = updaterFixture();
    failDecline = false;
    dispose = registerUpdaterIpc({
      getWindow,
      rendererURL,
      updates: fixture.updates,
      ipcMain: {
        removeHandler: (name) => ipcMain.removeHandler(name),
        handle: (name, handler) =>
          ipcMain.handle(name, async (event, command, value) => {
            if (command === 'decline' && failDecline) return { ok: false, error: 'operation' };
            const reply = await handler(event, command, value);
            if (command === 'state' && holdSnapshot) {
              holdSnapshot = false;
              snapshotGate = deferred();
              await snapshotGate.promise;
              snapshotGate = null;
            }
            return reply;
          }),
      },
    });
  };
  reset();
  ipcMain.handle('fixture-updater', (_event, operation, value) => {
    switch (operation) {
      case 'reset':
        reset();
        break;
      case 'complete':
        fixture.completeDownload();
        break;
      case 'progress':
        fixture.library.emit('download-progress', { percent: value });
        break;
      case 'available':
        fixture.library.emit('update-available', fixture.release);
        break;
      case 'fail-download':
        fixture.failDownload();
        break;
      case 'finish-stop':
        fixture.stop.resolve();
        break;
      case 'fail-stop':
        fixture.stop.reject(new Error('Synthetic SDK shutdown failure'));
        break;
      case 'fail-decline':
        failDecline = true;
        break;
      case 'allow-decline':
        failDecline = false;
        break;
      case 'hold-snapshot':
        holdSnapshot = true;
        break;
      case 'release-snapshot':
        snapshotGate.resolve();
        break;
    }
    return { state: fixture.updates.snapshot(), calls: fixture.calls, pendingSnapshot: !!snapshotGate };
  });
};
