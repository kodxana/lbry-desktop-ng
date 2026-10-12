const semver = require('semver');
const { EventEmitter } = require('events');
const source = require('../release-source.json');
const DesktopGitHubProvider = require('./DesktopGitHubProvider.cjs');

// Keep installation behind SDK shutdown: electron-updater starts NSIS before app.quit().
class DesktopUpdater extends EventEmitter {
  constructor(updater, { enabled, version, stopSdk, onError }) {
    super();
    this.updater = updater;
    this.enabled = enabled;
    this.version = version;
    this.stopSdk = stopSdk;
    this.onError = onError;
    this.state = 'idle';
    this.info = null;
    this.accepted = false;
    this.declined = false;
    this.revision = 0;
    this.percent = null;
    this.failed = false;
    this.installationFailed = false;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.disableWebInstaller = true;
    updater.allowDowngrade = false;
    updater.allowPrerelease = false;
    if (enabled) updater.setFeedURL({ ...source, provider: 'custom', updateProvider: DesktopGitHubProvider });

    updater.on('update-available', (info) => {
      this.info = info;
      this.state = 'available';
      this.changed();
    });
    updater.on('update-not-available', () => {
      this.info = null;
      this.state = 'idle';
      this.changed();
    });
    updater.on('download-progress', (progress) => {
      this.state = 'downloading';
      this.percent =
        progress && Number.isFinite(progress.percent) ? Math.max(0, Math.min(100, progress.percent)) : null;
      this.changed();
    });
    updater.on('update-downloaded', (info) => {
      this.info = info;
      this.state = 'downloaded';
      this.percent = 100;
      this.changed();
      if (this.accepted) this.install();
    });
    updater.on('error', (error) => {
      this.accepted = false;
      this.state = this.downloading && this.info ? 'available' : 'idle';
      if (this.state === 'idle') this.info = null;
      const installing = this.installing === true;
      this.installing = false;
      this.failed = true;
      this.installationFailed = installing;
      this.changed();
      this.onError(error, installing);
    });
  }

  snapshot() {
    return {
      revision: this.revision,
      enabled: this.enabled,
      state: this.state,
      checking: this.checking === true,
      installing: this.installing === true,
      available: this.isAllowed(),
      version: this.info ? this.info.version : null,
      accepted: this.accepted,
      declined: this.declined,
      percent: this.percent,
      failed: this.failed,
      installationFailed: this.installationFailed,
    };
  }

  changed() {
    this.revision++;
    this.emit('state', this.snapshot());
  }

  setPrereleases(allow) {
    this.updater.allowPrerelease = allow === true;
    if (!this.isAllowed()) this.accepted = false;
    // Changing the release channel must never enable downgrades.
    this.updater.allowDowngrade = false;
    this.changed();
  }

  versionInfo() {
    return {
      localVersion: this.version,
      remoteVersion: this.info ? this.info.version : undefined,
      upgradeAvailable: this.isAllowed(),
    };
  }

  isAllowed() {
    return !!(
      this.enabled &&
      this.info &&
      semver.valid(this.info.version) &&
      semver.gt(this.info.version, this.version) &&
      (this.updater.allowPrerelease || !semver.prerelease(this.info.version))
    );
  }

  async check({ autoDownload = false, allowPrerelease = false } = {}) {
    if (!this.enabled) return;
    this.setPrereleases(allowPrerelease);
    if (this.checking || this.downloading || this.installing || (this.state === 'downloaded' && this.isAllowed())) {
      return;
    }
    this.checking = true;
    this.failed = false;
    this.installationFailed = false;
    this.changed();
    try {
      // Download explicitly so that preference checks and errors share one path.
      await this.updater.checkForUpdates();
      if (autoDownload && !this.declined && this.isAllowed()) await this.download();
    } catch (_) {
      /* electron-updater emits an error; leave the app running. */
    } finally {
      this.checking = false;
      this.changed();
    }
  }

  async download() {
    if (!this.isAllowed() || this.downloading || this.state === 'downloaded') return;
    this.downloading = true;
    this.state = 'downloading';
    this.percent = null;
    this.failed = false;
    this.installationFailed = false;
    this.changed();
    try {
      await this.updater.downloadUpdate();
    } catch (_) {
      /* The updater's error event resets the state and reports the failure. */
    } finally {
      this.downloading = false;
    }
  }

  accept() {
    if (!this.isAllowed()) return;
    this.accepted = true;
    this.declined = false;
    this.changed();
    return this.state === 'downloaded' ? this.install() : this.download();
  }

  decline() {
    this.accepted = false;
    this.declined = true;
    this.changed();
  }

  async install() {
    if (!this.isAllowed() || !this.accepted || this.state !== 'downloaded' || this.installing) return;
    this.installing = true;
    this.failed = false;
    this.installationFailed = false;
    const version = this.info.version;
    this.changed();
    try {
      await this.stopSdk();
      if (!this.accepted || !this.isAllowed() || this.info.version !== version) {
        throw new Error('Update installation was cancelled after SDK shutdown. Please restart the application.');
      }
      this.updater.quitAndInstall(false, true);
    } catch (error) {
      this.accepted = false;
      this.installing = false;
      this.failed = true;
      this.installationFailed = true;
      this.changed();
      this.onError(error, true);
    }
  }
}

module.exports = DesktopUpdater;
