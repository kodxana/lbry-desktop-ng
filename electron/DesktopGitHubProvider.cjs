const { GitHubProvider } = require('electron-updater/out/providers/GitHubProvider');
const semver = require('semver');

// Updater 6 keeps an installed prerelease on its channel. Also consider stable
// releases so an RC can graduate without users changing their update preference.
class DesktopGitHubProvider extends GitHubProvider {
  constructor(options, updater, runtimeOptions) {
    super(options, updater, runtimeOptions);
    this.channelUpdater = updater;
    const stablePolicy = Object.create(updater, { allowPrerelease: { value: false } });
    this.stableProvider = new GitHubProvider(options, stablePolicy, runtimeOptions);
  }

  setRequestHeaders(headers) {
    super.setRequestHeaders(headers);
    this.stableProvider.setRequestHeaders(headers);
  }

  async getLatestVersion() {
    if (!this.channelUpdater.allowPrerelease || !semver.prerelease(this.channelUpdater.currentVersion.version)) {
      return super.getLatestVersion();
    }
    const results = await Promise.allSettled([super.getLatestVersion(), this.stableProvider.getLatestVersion()]);
    const releases = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    // A repository may have only RCs, or no RCs left in its release feed.
    if (!releases.length) throw results[0].reason;
    return releases.reduce((latest, release) => (semver.gt(release.version, latest.version) ? release : latest));
  }
}

module.exports = DesktopGitHubProvider;
