/* eslint no-console:0 */
const assert = require('assert').strict;
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const yaml = require('js-yaml');
const DesktopUpdater = require('../electron/DesktopUpdater.cjs');
const DesktopGitHubProvider = require('../electron/DesktopGitHubProvider.cjs');
const Daemon = require('../electron/Daemon.cjs');
const source = require('../release-source.json');
const { createProfile } = require('../electron/testProfile.cjs');
const settings = require('../desktop-settings.json');
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function testInstallation() {
  for (const result of [
    { code: 0, signal: null },
    { code: 1, signal: null },
    { code: null, signal: 'SIGKILL' },
  ]) {
    const daemon = Object.create(Daemon.prototype);
    daemon.quit = async () => {};
    daemon.exited = Promise.resolve(result);
    if (result.code === 0) await daemon.quitForUpdate();
    else await assert.rejects(daemon.quitForUpdate(), /did not exit cleanly/);
  }
  const updater = new EventEmitter();
  const errors = [];
  let downloads = 0,
    installs = 0,
    stops = 0,
    finishStop,
    failStop = false;
  updater.setFeedURL = (value) =>
    assert.deepEqual(value, {
      ...source,
      provider: 'custom',
      updateProvider: DesktopGitHubProvider,
    });
  updater.downloadUpdate = async () => {
    downloads++;
  };
  updater.quitAndInstall = () => {
    installs++;
  };
  const control = new DesktopUpdater(updater, {
    enabled: true,
    version: '0.54.0-rc.1',
    stopSdk: async () => {
      stops++;
      if (failStop) throw new Error('SDK did not exit');
      await new Promise((resolve) => {
        finishStop = resolve;
      });
    },
    onError: (error) => errors.push(error.message),
  });
  const release = { version: '0.54.0', releaseName: 'A human-readable release title' };
  updater.emit('update-available', release);
  assert.equal(control.versionInfo().remoteVersion, '0.54.0');
  assert.equal(updater.autoInstallOnAppQuit, false);
  await control.accept();
  assert.equal(downloads, 1);
  assert.equal(installs, 0);
  control.decline();
  updater.emit('update-downloaded', release);
  await tick();
  assert.equal(stops, 0, 'Declining must cancel the pending install');
  const installation = control.accept();
  await control.accept();
  assert.equal(stops, 1, 'Repeated clicks must not start another shutdown');
  assert.equal(installs, 0, 'Installer must wait for SDK exit');
  finishStop();
  await installation;
  assert.equal(installs, 1);
  assert.deepEqual(errors, []);

  control.installing = false;
  failStop = true;
  await control.accept();
  assert.equal(installs, 1, 'A shutdown failure must prevent installation');
  assert.deepEqual(errors, ['SDK did not exit']);

  for (const version of ['not-a-version', '0.53.9', '0.54.0-rc.1', '0.55.0-rc.1']) {
    updater.emit('update-available', { version });
    await control.accept();
    assert.equal(installs, 1, 'Invalid, old, equal and unrequested prereleases must be refused');
    assert.equal(downloads, 1);
  }
  control.setPrereleases(true);
  assert.equal(control.isAllowed(), true);
  assert.equal(updater.allowDowngrade, false);
  console.log('PASS: consent, version checks, duplicate clicks and SDK shutdown before installation');
}

async function testDownloads(root, legacy = false, builtMetadata = null) {
  const packageName = legacy ? 'electron-updater-legacy' : 'electron-updater';
  const { NsisUpdater } = require(packageName);
  const { ElectronHttpExecutor } = require(packageName + '/out/electronHttpExecutor');
  const updaterVersion = require(packageName + '/package.json').version;
  // Use the installed NSIS updater and GitHub provider. Only replace the HTTP transport;
  // all release parsing, channel selection, caching and digest validation remain real.
  const payload = Buffer.from('Desktop updater test data, never an executable.');
  const sha512 = crypto.createHash('sha512').update(payload).digest('base64');
  const base = '/' + source.owner + '/' + source.repo + '/releases';
  let entries = ['0.55.0-rc.1', '0.54.0'];
  let stableTag = 'v0.54.0';
  let corrupt = false,
    missing = false,
    interrupted = false,
    assetRequests = 0;
  const requested = [];
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    requested.push(url);
    if (missing) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    if (url === base + '.atom') {
      res.end(
        '<feed>' +
          entries
            .map(
              (version) =>
                `<entry><title>Desktop NG ${version}</title>` +
                `<link href="https://github.com${base}/tag/v${version}"/><content>Release notes</content></entry>`
            )
            .join('') +
          '</feed>'
      );
    } else if (url === base + '/latest') {
      if (!stableTag) {
        res.writeHead(404);
        res.end('No stable release');
        return;
      }
      res.end(JSON.stringify({ tag_name: stableTag }));
    } else if (url.endsWith('/latest.yml')) {
      if (builtMetadata) {
        res.end(builtMetadata.raw);
        return;
      }
      const version = url.split('/').slice(-2)[0].slice(1);
      const file = `LBRY-Desktop-NG-${version}-windows-x64.exe`;
      res.end(`version: ${version}\nfiles:\n  - url: ${file}\n    sha512: ${sha512}\n    size: ${payload.length}\n`);
    } else if (url.endsWith('.exe')) {
      assetRequests++;
      const data = corrupt ? Buffer.from('corrupted installer') : payload;
      res.writeHead(200, { 'Content-Length': data.length });
      if (interrupted) {
        res.write(data.subarray(0, 5));
        setImmediate(() => res.destroy());
        return;
      }
      res.end(data);
    } else {
      res.writeHead(404);
      res.end('Unexpected fixture request');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const errors = [];
  function createUpdater(directory = root) {
    fs.mkdirSync(directory, { recursive: true });
    const app = {
      version: '0.54.0-rc.1',
      name: 'desktop-updater-test',
      isPackaged: true,
      userDataPath: directory,
      baseCachePath: directory,
      appUpdateConfigPath: path.join(directory, 'app-update.yml'),
      whenReady: async () => {},
      onQuit: () => assert.fail('An update must not install automatically on quit'),
      quit: () => assert.fail('This test must not quit or launch an installer'),
    };
    fs.writeFileSync(app.appUpdateConfigPath, 'updaterCacheDirName: ng-update-test\n');
    const updater = new NsisUpdater(null, app);
    updater.logger = null;
    updater._testOnlyOptions = { platform: 'win32', isUseDifferentialDownload: false };
    const executor = new ElectronHttpExecutor();
    executor.createRequest = (options, callback) => {
      assert.equal(options.hostname, 'github.com');
      assert(options.path.startsWith(base), 'All update requests must use the fork');
      return http.request(
        { ...options, protocol: 'http:', hostname: '127.0.0.1', port: server.address().port, agent: false },
        callback
      );
    };
    updater.httpExecutor = executor;
    const quitAndInstall = updater.quitAndInstall.bind(updater);
    updater.quitAndInstall = () => assert.fail('Download tests must never run an installer');
    const control = new DesktopUpdater(updater, {
      enabled: true,
      version: app.version,
      stopSdk: () => assert.fail('No installation was requested'),
      onError: (error) => errors.push(error),
    });
    // RC1-RC3 used updater 4's built-in GitHub provider. Exercise that exact
    // provider as well as the new app's stable/RC selection policy.
    if (legacy) updater.setFeedURL(source);
    return { app, updater, control, quitAndInstall };
  }
  const { app, updater, control, quitAndInstall } = createUpdater();
  try {
    if (builtMetadata) {
      entries = [builtMetadata.info.version];
      stableTag = null;
      await control.check({ allowPrerelease: true });
      assert.equal(control.versionInfo().remoteVersion, builtMetadata.info.version);
      assert.equal(control.versionInfo().upgradeAvailable, true);
      assert.deepEqual(updater.updateInfoAndProvider.info.files, builtMetadata.info.files);
      assert.equal(errors.length, 0);
      assert.equal(assetRequests, 0);
      console.log('PASS: updater ' + updaterVersion + ' discovers the actual built release metadata');
      return;
    }
    await control.check();
    assert.equal(control.versionInfo().remoteVersion, '0.54.0');
    assert.equal(assetRequests, 0, 'Checking with automatic downloads disabled must not fetch an installer');
    assert(requested.includes(base + '/download/v0.54.0/latest.yml'));
    await control.check({ allowPrerelease: true });
    assert.equal(control.versionInfo().remoteVersion, '0.55.0-rc.1');
    assert(requested.includes(base + '/download/v0.55.0-rc.1/latest.yml'));

    entries = ['0.54.0', '0.54.0-rc.2'];
    await control.check({ allowPrerelease: true });
    assert.equal(control.versionInfo().remoteVersion, '0.54.0', 'RC users must be offered the newer stable release');
    entries = ['0.54.0'];
    await control.check({ allowPrerelease: true });
    assert.equal(control.versionInfo().remoteVersion, '0.54.0', 'Stable updates must work after RCs leave the feed');
    entries = ['0.55.0-rc.1'];
    stableTag = null;
    await control.check({ allowPrerelease: true });
    assert.equal(control.versionInfo().remoteVersion, '0.55.0-rc.1', 'A prerelease-only repository must still update');
    assert.equal(errors.length, 0);
    stableTag = 'v0.54.0';
    entries = ['0.55.0-rc.1', '0.54.0'];

    corrupt = true;
    await control.download();
    assert.equal(control.state, 'available');
    assert.equal(errors.length, 1);
    assert.equal(errors[0].code, 'ERR_CHECKSUM_MISMATCH');
    assert.equal(updater.downloadedUpdateHelper.file, null);
    corrupt = false;
    await control.check({ autoDownload: true, allowPrerelease: true });
    assert.equal(control.state, 'downloaded');
    assert.deepEqual(fs.readFileSync(updater.downloadedUpdateHelper.file), payload);
    assert.equal(errors.length, 1);

    const requestsAfterDownload = assetRequests;
    const cached = createUpdater();
    await cached.control.check({ allowPrerelease: true });
    await cached.control.download();
    assert.equal(assetRequests, requestsAfterDownload, 'A restarted updater should reuse its verified cache');
    fs.writeFileSync(cached.updater.downloadedUpdateHelper.file, 'corrupted cached installer');
    const recovered = createUpdater();
    await recovered.control.check({ allowPrerelease: true });
    await recovered.control.download();
    assert.equal(assetRequests, requestsAfterDownload + 1, 'Corrupt cached bytes must be downloaded again');
    assert.deepEqual(fs.readFileSync(recovered.updater.downloadedUpdateHelper.file), payload);

    const partial = createUpdater(path.join(root, 'interrupted'));
    await partial.control.check({ allowPrerelease: true });
    const errorsBeforeInterrupt = errors.length;
    interrupted = true;
    await partial.control.download();
    assert.equal(partial.control.state, 'available');
    assert.equal(errors.length, errorsBeforeInterrupt + 1);
    assert.equal(partial.updater.downloadedUpdateHelper.file, null);
    interrupted = false;
    await partial.control.download();
    assert.equal(partial.control.state, 'downloaded');
    assert.deepEqual(fs.readFileSync(partial.updater.downloadedUpdateHelper.file), payload);

    if (!legacy) {
      const fallback = createUpdater(path.join(root, 'differential-fallback'));
      await fallback.control.check({ allowPrerelease: true });
      // Upstream's test-only mode throws instead of falling back. Restore the
      // production path after selecting Windows metadata on either CI host.
      fallback.updater._testOnlyOptions = null;
      const requestsBeforeFallback = requested.length;
      const errorsBeforeFallback = errors.length;
      await fallback.control.download();
      assert(requested.slice(requestsBeforeFallback).some((url) => url.endsWith('.blockmap')));
      assert.equal(fallback.control.state, 'downloaded');
      assert.equal(errors.length, errorsBeforeFallback);
      assert.deepEqual(fs.readFileSync(fallback.updater.downloadedUpdateHelper.file), payload);
      console.log('PASS: missing blockmap falls back to a checksum-verified full installer');
    }

    if (process.versions.electron && !legacy) {
      // Keep the real quitAndInstall path. Intercept only the final installer
      // launch and application quit; the downloaded fixture is never executed.
      const events = [];
      let finishStop;
      let stopped = false;
      app.quit = () => events.push('quit');
      updater.quitAndInstall = quitAndInstall;
      updater.doInstall = (options) => {
        assert(stopped, 'The installer must wait for SDK shutdown');
        assert.equal(options.isSilent, false);
        assert.equal(options.isForceRunAfter, true);
        events.push('installer');
        return true;
      };
      control.stopSdk = () =>
        new Promise((resolve) => {
          finishStop = () => {
            stopped = true;
            resolve();
          };
        });
      const install = control.accept();
      await control.accept();
      assert.deepEqual(events, []);
      finishStop();
      await install;
      await tick();
      assert.deepEqual(events, ['installer', 'quit']);
      console.log('PASS: real updater install handoff waits for SDK shutdown and requests application restart');
    }
    // A fresh repository and offline/error responses must not reject into the IPC handler.
    control.state = 'idle';
    control.installing = false;
    missing = true;
    const errorsBeforeMissing = errors.length;
    await control.check();
    assert.equal(control.state, 'idle');
    assert.equal(control.versionInfo().localVersion, app.version);
    assert.equal(control.versionInfo().upgradeAvailable, false);
    assert.equal(errors.length, errorsBeforeMissing + 1);
    const requestsBefore = requested.length;
    control.enabled = false;
    await control.check({ autoDownload: true });
    await control.accept();
    assert.equal(requested.length, requestsBefore, 'Isolated builds must never check or download updates');
    console.log(
      'PASS: updater ' +
        updaterVersion +
        ': RC/stable selection, corrupt/interrupted downloads, cache recovery and missing releases'
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  const runs = path.resolve(__dirname, '../dist/update-tests');
  fs.mkdirSync(runs, { recursive: true });
  const root = fs.mkdtempSync(path.join(runs, 'run-'));
  const profile = createProfile(path.join(root, 'ng'), settings);
  assert.equal(profile.ports.apiPort, 36279);
  assert.throws(() => createProfile(profile.root), /different application/);
  assert.deepEqual(createProfile(profile.root, settings), profile);
  const builder = require('../electron-builder.json');
  assert.equal(builder.appId, settings.appId);
  assert.equal(builder.productName, settings.appName);
  assert.deepEqual(builder.publish, [source]);
  assert.equal(require('../electron-builder.sdk-test.json').publish, null);
  console.log('PASS: independent NG/test profile ownership and matching build/update identities');
  await testInstallation();
  const builtMetadata = process.argv.includes('--built-metadata')
    ? { raw: fs.readFileSync(path.resolve(__dirname, '../dist/ng/latest.yml'), 'utf8') }
    : null;
  if (builtMetadata) builtMetadata.info = yaml.load(builtMetadata.raw);
  await testDownloads(path.join(root, 'current'), false, builtMetadata);
  await testDownloads(path.join(root, 'legacy'), true, builtMetadata);
}

module.exports = main;
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
