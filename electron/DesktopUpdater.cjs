const semver = require('semver');
const source = require('../release-source.json');
const DesktopGitHubProvider = require('./DesktopGitHubProvider.cjs');

// Keep installation behind SDK shutdown: electron-updater starts NSIS before app.quit().
class DesktopUpdater {
  constructor(updater, { enabled, version, stopSdk, onError }) {
    this.updater = updater;
    this.enabled = enabled;
    this.version = version;
    this.stopSdk = stopSdk;
    this.onError = onError;
    this.state = 'idle';
    this.info = null;
    this.accepted = false;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.disableWebInstaller = true;
    updater.allowDowngrade = false;
    updater.allowPrerelease = false;
    if (enabled) updater.setFeedURL({ ...source, provider: 'custom', updateProvider: DesktopGitHubProvider });

    updater.on('update-available', info => {
      this.info = info;
      this.state = 'available';
    });
    updater.on('update-not-available', () => {
      this.info = null;
      this.state = 'idle';
    });
    updater.on('download-progress', () => { this.state = 'downloading' });
    updater.on('update-downloaded', info => {
      this.info = info;
      this.state = 'downloaded';
      if (this.accepted) this.install();
    });
    updater.on('error', error => {
      this.accepted = false;
      this.state = this.downloading && this.info ? 'available' : 'idle';
      if (this.state === 'idle') this.info = null;
      this.onError(error, this.installing === true);
      this.installing = false;
    });
  }

  setPrereleases(allow) {
    this.updater.allowPrerelease = allow === true;
    if (!this.isAllowed()) this.accepted = false;
    // Changing the release channel must never enable downgrades.
    this.updater.allowDowngrade = false;
  }

  versionInfo() {
    return {
      localVersion: this.version,
      remoteVersion: this.info ? this.info.version : undefined,
      upgradeAvailable: this.isAllowed(),
    };
  }

  isAllowed() {
    return !!(this.enabled && this.info && semver.valid(this.info.version) &&
      semver.gt(this.info.version, this.version) &&
      (this.updater.allowPrerelease || !semver.prerelease(this.info.version)));
  }

  async check({ autoDownload = false, allowPrerelease = false } = {}) {
    if (!this.enabled) return;
    this.setPrereleases(allowPrerelease);
    if (this.checking || this.downloading || this.installing ||
      (this.state === 'downloaded' && this.isAllowed())) return;
    this.checking = true;
    try {
      // Download explicitly so that preference checks and errors share one path.
      await this.updater.checkForUpdates();
      if (autoDownload && this.isAllowed()) await this.download();
    } catch (_) { /* electron-updater emits an error; leave the app running. */ }
    finally { this.checking = false }
  }

  async download() {
    if (!this.isAllowed() || this.downloading || this.state === 'downloaded') return;
    this.downloading = true;
    this.state = 'downloading';
    try { await this.updater.downloadUpdate() }
    catch (_) { /* The updater's error event resets the state and reports the failure. */ }
    finally { this.downloading = false }
  }

  accept() {
    if (!this.isAllowed()) return;
    this.accepted = true;
    return this.state === 'downloaded' ? this.install() : this.download();
  }

  decline() {
    this.accepted = false;
  }

  async install() {
    if (!this.isAllowed() || !this.accepted || this.state !== 'downloaded' || this.installing) return;
    this.installing = true;
    try {
      await this.stopSdk();
      if (!this.accepted || !this.isAllowed()) {
        throw new Error('Update installation was cancelled after SDK shutdown. Please restart the application.');
      }
      this.updater.quitAndInstall(false, true);
    } catch (error) {
      this.accepted = false;
      this.installing = false;
      this.onError(error, true);
    }
  }
}

module.exports = DesktopUpdater;
