// Loaded by the test harness into the installed application's main process.
// This file is not shipped in the application.
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { app, session } = require('electron');
let state;

exports.configure = ({ profile, url, sdkPids, evidence }) => {
  assert(process.platform === 'win32' && process.env.GITHUB_ACTIONS === 'true');
  assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted');
  assert.equal(app.getPath('userData'), path.join(profile, 'desktop'));
  assert.equal(new URL(url).hostname, '127.0.0.1');
  const { autoUpdater } = require(path.join(app.getAppPath(), 'node_modules/electron-updater'));
  assert.equal(autoUpdater.autoInstallOnAppQuit, false);
  autoUpdater.setFeedURL({ provider: 'generic', url });
  autoUpdater.autoDownload = false;
  state = { available: false, downloaded: false, error: null, handoffs: 0 };
  autoUpdater.on('update-available', () => (state.available = true));
  autoUpdater.on('update-downloaded', () => (state.downloaded = true));
  autoUpdater.on('error', (error) => (state.error = error.message));
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (details, callback) => callback({ cancel: new URL(details.url).hostname !== '127.0.0.1' })
  );
  const install = autoUpdater.quitAndInstall.bind(autoUpdater);
  autoUpdater.quitAndInstall = (silent, restart) => {
    assert.equal(silent, false, 'The application must request the normal installer');
    assert.equal(restart, true);
    assert(sdkPids.length > 0);
    for (const pid of sdkPids) {
      let sdkAlive = true;
      try {
        process.kill(pid, 0);
      } catch (error) {
        assert.equal(error.code, 'ESRCH');
        sdkAlive = false;
      }
      assert.equal(sdkAlive, false, 'SDK process must exit before native installer launch');
    }
    const log = fs.readFileSync(path.join(profile, 'logs/daemon-console.log'), 'utf8');
    assert(log.includes('finished shutting down'));
    assert(!log.includes('Task was destroyed but it is pending!'));
    state.handoffs++;
    fs.writeFileSync(
      evidence,
      JSON.stringify({
        sourceVersion: app.getVersion(),
        cleanSdkExitBeforeInstall: true,
        handoffs: state.handoffs,
        restart: true,
        installer: path.basename(autoUpdater.downloadedUpdateHelper.file),
      })
    );
    // CI has no operator for the wizard. Keep real NSIS execution and restart;
    // change only its presentation to unattended mode.
    return install(true, restart);
  };
  return app.getVersion();
};

exports.status = () => state;
