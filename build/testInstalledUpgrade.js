/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const net = require('net');
const { spawn, spawnSync } = require('child_process');
const fetch = require('node-fetch');
const asar = require('@electron/asar');
const yaml = require('js-yaml');
const settings = require('../desktop-settings.json');
const sdkCandidate = require('./sdk-candidate.json');
const { createProfile, assertPortsAvailable } = require('../electron/testProfile.cjs');
const {
  assertHostedWindows,
  delay,
  until,
  request,
  connectRenderer,
  connectMain,
  listen,
  hubFixture,
  powershell,
  applicationProcesses,
  closeApplication,
} = require('./installedUpgradeSupport.cjs');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist/installed-upgrade');
const evidenceDirectory = path.join(root, 'dist/ci/installed-upgrade');
const published = {
  version: '0.54.0-rc.3',
  name: 'LBRY-Desktop-NG-0.54.0-rc.3-windows-x64.exe',
  sha256: '090218f260c8772392d9105d4fbb9b899af70d4fed2fe1b8473435ebd5548596',
  electron: '17.2.0',
};
const password = 'Unfunded installed upgrade fixture ł';
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function runNode(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, NODE_ENV: 'production', CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'Build command failed: ' + args[0]);
}

function buildCandidate(version) {
  const packageFile = path.join(root, 'package.json');
  const original = fs.readFileSync(packageFile);
  const directory = path.join(output, version);
  try {
    const pkg = JSON.parse(original);
    pkg.version = version;
    fs.writeFileSync(packageFile, JSON.stringify(pkg, null, 2) + '\n');
    runNode([
      '--max_old_space_size=4096',
      'node_modules/webpack/bin/webpack.js',
      '--config',
      'webpack.electron.config.js',
    ]);
    runNode([
      '.yarn/releases/yarn-3.2.0.cjs',
      'exec',
      'electron-builder',
      '--win',
      '--x64',
      '--publish',
      'never',
      '--config',
      'electron-builder.json',
      '--config.directories.output=' + directory,
    ]);
    const metadata = yaml.load(fs.readFileSync(path.join(directory, 'latest.yml'), 'utf8'));
    assert.equal(metadata.version, version);
    const installer = path.join(directory, metadata.files[0].url);
    const bytes = fs.readFileSync(installer);
    assert.equal(bytes.length, metadata.files[0].size);
    assert.equal(crypto.createHash('sha512').update(bytes).digest('base64'), metadata.files[0].sha512);
    const archive = path.join(directory, 'win-unpacked/resources/app.asar');
    assert.equal(JSON.parse(asar.extractFile(archive, 'package.json')).version, version);
    return {
      version,
      directory,
      metadata,
      installer,
      sha256: hash(bytes),
      archiveHash: hash(fs.readFileSync(archive)),
    };
  } finally {
    fs.writeFileSync(packageFile, original);
  }
}

async function updateServer(candidate) {
  let release;
  let held = false;
  let requests = 0;
  const gate = new Promise((resolve) => (release = resolve));
  const server = http.createServer(async (req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname.slice(1));
    if (/^(latest|rc)\.yml$/.test(name)) return res.end(yaml.dump(candidate.metadata));
    if (name === path.basename(candidate.installer)) {
      requests++;
      held = true;
      await gate;
      res.setHeader('Content-Length', fs.statSync(candidate.installer).size);
      return fs.createReadStream(candidate.installer).pipe(res);
    }
    res.writeHead(404);
    res.end();
  });
  const port = await listen(server);
  return {
    url: 'http://127.0.0.1:' + port,
    release,
    held: () => held,
    requests: () => requests,
    close: () => {
      release();
      server.closeAllConnections();
      server.close();
    },
  };
}

async function main() {
  assertHostedWindows();
  assert.equal(process.versions.node, fs.readFileSync(path.join(root, '.node-version'), 'utf8').trim());
  const profileRoot = path.join(process.env.APPDATA, settings.appName);
  const installDirectory = path.join(process.env.RUNNER_TEMP, 'lbry-installed-upgrade');
  const executable = path.join(installDirectory, settings.appName + '.exe');
  assert(!fs.existsSync(profileRoot), 'The runner must not have an existing NG profile');
  assert(!fs.existsSync(installDirectory), 'Use an empty installation directory');
  assert.equal(
    powershell(
      "@(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq 'LBRY Desktop NG' }).Count"
    ),
    '0',
    'The runner must not have an installed NG application'
  );
  await assertPortsAvailable(settings);
  fs.mkdirSync(output, { recursive: true });
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  // Private test versions; package.json is restored after each complete compile/package.
  const candidates = ['0.54.0-rc.4.upgrade-test', '0.54.0-rc.5.upgrade-test'].map(buildCandidate);
  const url =
    'https://github.com/kodxana/lbry-desktop-ng/releases/download/v' + published.version + '/' + published.name;
  const response = await fetch(url, { timeout: 120000, size: 256 * 1024 * 1024 });
  assert(response.ok, 'Published RC3 installer download failed: ' + response.status);
  const bytes = await response.buffer();
  assert.equal(hash(bytes), published.sha256, 'Published installer must match the recorded RC3 release');
  const oldInstaller = path.join(output, published.name);
  fs.writeFileSync(oldInstaller, bytes);
  const installed = spawnSync(oldInstaller, ['/S', '/currentuser', '/D=' + installDirectory], {
    windowsHide: true,
    timeout: 180000,
    encoding: 'utf8',
  });
  if (installed.error) throw installed.error;
  assert.equal(installed.status, 0, 'RC3 installer failed');
  assert(fs.existsSync(executable));
  console.log('PASS: installed the checksum-pinned published RC3 with its real NSIS installer');

  const profile = createProfile(profileRoot, settings);
  const closeHub = await hubFixture(profile);
  const rpc = async (method, params = {}) => {
    const reply = await request(settings.apiPort, '/', { method, params });
    assert(!reply.error, 'Fixture SDK RPC failed: ' + method);
    return reply.result;
  };
  const waitForWallet = () =>
    until(async () => {
      try {
        const status = await rpc('status');
        return (
          status.is_running && status.wallet?.history_sync?.state === 'complete' && status.wallet.history_sync.connected
        );
      } catch (_) {
        return false;
      }
    }, 'Installed SDK did not finish local fixture sync');
  const verifyProfile = async () => {
    const actual = await rpc('settings_get');
    for (const [name, folder] of [
      ['data_dir', 'data'],
      ['wallet_dir', 'wallet'],
      ['download_dir', 'downloads'],
    ]) {
      assert.equal(path.resolve(actual[name]), profile[folder]);
    }
    assert.equal(actual.blockchain_name, 'lbrycrd_regtest');
    assert.equal((await rpc('wallet_balance')).total, '0.0');
  };
  const walletFile = path.join(profile.wallet, 'wallets/default_wallet');
  const keyHash = () =>
    hash(
      Buffer.from(
        JSON.stringify(
          JSON.parse(fs.readFileSync(walletFile)).accounts.map((account) => [account.seed, account.private_key])
        )
      )
    );
  const sdk = path.join(installDirectory, 'resources/static/daemon/lbrynet.exe');
  const sdkPids = () => {
    const value = powershell(
      '@(Get-CimInstance Win32_Process -Filter "Name=\'lbrynet.exe\'" | Where-Object { $_.ExecutablePath -eq $env:LBRY_UPGRADE_SDK } | Select-Object -ExpandProperty ProcessId) | ConvertTo-Json -Compress',
      { LBRY_UPGRADE_SDK: sdk }
    );
    return value ? [].concat(JSON.parse(value)) : [];
  };
  let client;
  let mainClient;
  let running;
  const indexedState = { subscriptions: ['@fixture#123'], positions: { fixture: 42 }, label: 'Saved state ł' };
  // Exercise a database physically created by the old Chromium runtime, rather
  // than seeding the new runtime with a JSON representation of old UI state.
  const indexedDBState = (write = false) =>
    client.evaluate(`new Promise((resolve, reject) => {
    const opened = indexedDB.open('installed-upgrade-fixture', 1);
    opened.onerror = () => reject(opened.error);
    opened.onblocked = () => reject(new Error('Fixture database is blocked'));
    opened.onupgradeneeded = () => opened.result.createObjectStore('state');
    opened.onsuccess = () => {
      const database = opened.result;
      const transaction = database.transaction('state', ${JSON.stringify(write ? 'readwrite' : 'readonly')});
      const store = transaction.objectStore('state');
      const request = ${write ? `store.put(${JSON.stringify(indexedState)}, 'fixture')` : "store.get('fixture')"};
      transaction.oncomplete = () => {
        database.close();
        resolve(${write ? 'true' : 'request.result'});
      };
      transaction.onabort = transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error('Fixture transaction failed'));
      };
    };
  })`);
  const targetElectron = require('../package.json').devDependencies.electron;
  const launch = async () => {
    const reservation = net.createServer();
    const port = await listen(reservation);
    const mainReservation = net.createServer();
    const mainPort = await listen(mainReservation);
    await new Promise((resolve) => reservation.close(resolve));
    await new Promise((resolve) => mainReservation.close(resolve));
    running = spawn(
      executable,
      [
        '--disable-gpu',
        '--remote-debugging-port=' + port,
        '--remote-debugging-address=127.0.0.1',
        '--inspect=127.0.0.1:' + mainPort,
      ],
      {
        cwd: installDirectory,
        windowsHide: true,
      }
    );
    // Logs stay outside the uploaded evidence; assertions never print wallet data.
    const log = fs.createWriteStream(path.join(output, 'desktop-' + running.pid + '.log'));
    running.stdout.pipe(log, { end: false });
    running.stderr.pipe(log, { end: false });
    running.once('close', () => log.end());
    client = await connectRenderer(port);
    mainClient = await connectMain(mainPort);
    assert.equal(
      await mainClient.evaluate("process.mainModule.require('electron').app.getPath('userData')"),
      profile.desktop
    );
    await waitForWallet();
    await verifyProfile();
  };
  const helperPath = path.join(root, 'build/installedUpgradeMain.cjs');
  // Load the fixture through the test launch's loopback main-process inspector.
  // No test IPC or renderer-to-main module loader is shipped in the application.
  const helper = 'process.mainModule.require(' + JSON.stringify(helperPath) + ')';
  let feed;
  const evidence = { published, sourceCommit: process.env.GITHUB_SHA, hops: [] };
  try {
    await launch();
    assert.equal(
      await mainClient.evaluate("process.mainModule.require('electron').app.getVersion()"),
      published.version
    );
    const originalKeys = keyHash();
    assert.equal(await mainClient.evaluate('process.versions.electron'), published.electron);
    const originalAddresses = (await rpc('address_list')).items.map((item) => item.address).sort();
    assert(originalAddresses.length > 0);
    await client.evaluate("localStorage.setItem('installed-upgrade-fixture', 'preserve desktop storage'); true");
    assert.equal(await indexedDBState(true), true);
    assert.deepEqual(await indexedDBState(), indexedState);
    await client.evaluate(
      "document.cookie = 'upgrade_root_cookie=preserve-root; path=/;'; " +
        "document.cookie = 'upgrade_path_cookie=preserve-path'; true"
    );
    assert.equal(await rpc('wallet_encrypt', { new_password: password }), true);
    const saved = await client.evaluate(
      "require('electron').ipcRenderer.invoke('remembered-password', 'save', " + JSON.stringify(password) + ')'
    );
    assert.equal(saved.ok, true);
    const logger = "process.mainModule.require('electron-updater').autoUpdater.logger";
    const updaterLog = path.join(profile.logs, 'main.log');
    await mainClient.evaluate(logger + ".info('Published RC3 log fixture'); true");
    assert(fs.readFileSync(updaterLog, 'utf8').includes('Published RC3 log fixture'));
    for (let index = 0; index < candidates.length; index++) {
      const candidate = candidates[index];
      const legacy = index === 0;
      const sourceElectron = await mainClient.evaluate('process.versions.electron');
      assert.equal(sourceElectron, legacy ? published.electron : targetElectron);
      feed = await updateServer(candidate);
      const handoffFile = path.join(evidenceDirectory, 'handoff-' + index + '.json');
      const sourceVersion = await mainClient.evaluate(
        helper +
          '.configure(' +
          JSON.stringify({
            profile: profile.root,
            url: feed.url,
            sdkPids: sdkPids(),
            evidence: handoffFile,
          }) +
          ')'
      );
      const command = (name, value) =>
        client.evaluate(
          legacy
            ? "require('electron').ipcRenderer.send(" +
                JSON.stringify(
                  { check: 'check-for-updates', accept: 'autoUpdateAccepted', decline: 'autoUpdateDeclined' }[name]
                ) +
                ', ' +
                JSON.stringify(value) +
                '); true'
            : 'window.lbryDesktop.updater(' +
                JSON.stringify(name) +
                ', ' +
                JSON.stringify(value) +
                ').then(() => {}); true'
        );
      await command('check', { autoDownload: false, allowPrerelease: true });
      await until(
        () => mainClient.evaluate(helper + '.status().available'),
        'Installed updater did not discover the private candidate'
      );
      await command('accept');
      await until(feed.held, 'Installed updater did not request the real installer');
      await command('decline');
      if (!legacy) {
        await until(
          () =>
            client.evaluate(
              "window.lbryDesktop.updater('state').then(r => r.state.declined)"
            ),
          'Decline was not recorded'
        );
      } else {
        // Flush an IPC round trip after the legacy one-way decline message.
        await client.evaluate("require('electron').ipcRenderer.invoke('remembered-password', 'read').then(() => true)");
      }
      feed.release();
      await until(
        () => mainClient.evaluate(helper + '.status().downloaded'),
        'Native update download did not finish',
        180000
      );
      await delay(1000);
      assert.equal(
        (await mainClient.evaluate(helper + '.status()')).handoffs,
        0,
        'A declined download must not install'
      );
      assert(!fs.existsSync(handoffFile));
      await verifyProfile();
      const previousPid = running.pid;
      await command('accept');
      await until(
        () => fs.existsSync(handoffFile),
        'Updater did not reach a clean SDK shutdown and native installer handoff'
      );
      client.close();
      client = null;
      mainClient.close();
      mainClient = null;
      const restarted = await until(
        () =>
          applicationProcesses(executable).find(
            (p) => p.ProcessId !== previousPid && p.CommandLine.includes('--updated')
          ),
        'NSIS did not automatically restart the installed application',
        180000
      );
      await waitForWallet();
      await verifyProfile();
      const archive = path.join(installDirectory, 'resources/app.asar');
      assert.equal(
        hash(fs.readFileSync(archive)),
        candidate.archiveHash,
        'NSIS must replace the installed application'
      );
      assert.equal(JSON.parse(asar.extractFile(archive, 'package.json')).version, candidate.version);
      assert.equal(hash(fs.readFileSync(sdk)), sdkCandidate.artifacts.win32.sha256, 'Installed SDK hash changed');
      assert.equal((await rpc('wallet_status')).is_encrypted, true);
      assert.deepEqual((await rpc('address_list')).items.map((item) => item.address).sort(), originalAddresses);
      closeApplication(executable, restarted.ProcessId);
      await until(
        () => applicationProcesses(executable).length === 0 && sdkPids().length === 0,
        'Restarted application did not close cleanly'
      );
      await assertPortsAvailable(settings);
      await launch();
      assert.equal(await mainClient.evaluate('process.versions.electron'), targetElectron);
      assert.equal(await client.evaluate('window.lbryDesktop.electron'), targetElectron);
      assert.equal(await client.evaluate('typeof window.__electronLog'), 'undefined');
      assert.equal(
        await mainClient.evaluate("process.mainModule.require('electron').ipcMain.listenerCount('__ELECTRON_LOG__')"),
        0
      );
      assert.equal(await mainClient.evaluate(logger + '.transports.file.getFile().path'), updaterLog);
      await mainClient.evaluate(logger + ".info('Upgraded app log fixture'); true");
      const logContent = fs.readFileSync(updaterLog, 'utf8');
      assert(logContent.includes('Published RC3 log fixture') && logContent.includes('Upgraded app log fixture'));
      console.log('PASS: installed upgrade retains the existing updater log and appends without a renderer logging bridge');
      assert.deepEqual(await client.evaluate(`({ node: typeof require, process: typeof process,
        sandboxed: window.lbryDesktop.sandboxed })`), {
        node: 'undefined', process: 'undefined', sandboxed: true,
      });
      assert.equal(
        await mainClient.evaluate("process.mainModule.require('electron').app.getVersion()"),
        candidate.version
      );
      assert.equal(
        await client.evaluate("localStorage.getItem('installed-upgrade-fixture')"),
        'preserve desktop storage'
      );
      assert.deepEqual(await indexedDBState(), indexedState, 'The old Chromium IndexedDB must survive installation');
      assert(await client.evaluate("document.cookie.includes('upgrade_root_cookie=preserve-root')"));
      assert(
        await client.evaluate("document.cookie.includes('upgrade_path_cookie=preserve-path')"),
        'The legacy cookie adapter file-URL mapping must survive an installed upgrade'
      );
      const remembered = await client.evaluate("window.lbryDesktop.password('read')");
      assert(
        remembered.ok && remembered.password === password,
        'OS-protected password did not survive the installed upgrade'
      );
      assert.equal(await rpc('wallet_unlock', { password }), true);
      assert.equal(await rpc('wallet_decrypt'), true);
      assert(keyHash() === originalKeys, 'Wallet keys must survive installed upgrades');
      assert.equal(await rpc('wallet_encrypt', { new_password: password }), true);
      const handoff = JSON.parse(fs.readFileSync(handoffFile));
      assert.equal(handoff.handoffs, 1);
      evidence.hops.push({
        from: sourceVersion,
        sourceElectron,
        targetElectron,
        to: candidate.version,
        installerSha256: candidate.sha256,
        declinedDownloadDidNotInstall: true,
        automaticRestart: true,
        applicationArchiveMatched: true,
        sdkSha256: sdkCandidate.artifacts.win32.sha256,
        walletKeysPreserved: true,
        updaterLogPreserved: true,
        addressCount: originalAddresses.length,
        balance: '0.0',
        encryptedWallet: true,
        desktopStoragePreserved: true,
        indexedDBPreserved: true,
        cookieStorageAndPathPreserved: true,
        rememberedPasswordRecovered: true,
        ...handoff,
      });
      console.log(
        'PASS: native installed upgrade ' +
          sourceVersion +
          ' -> ' +
          candidate.version +
          '; decline, clean SDK shutdown, NSIS replacement, automatic restart and wallet/profile persistence'
      );
      feed.close();
      feed = null;
    }
    await client.evaluate("window.lbryDesktop.windowControl('quit'); true");
    client.close();
    client = null;
    mainClient.close();
    mainClient = null;
    await until(
      () => applicationProcesses(executable).length === 0 && sdkPids().length === 0,
      'Final test application did not exit'
    );
    await assertPortsAvailable(settings);
    const log = fs.readFileSync(path.join(profile.logs, 'daemon-console.log'), 'utf8');
    assert(!log.includes('Task was destroyed but it is pending!'));
    evidence.cleanSdkShutdowns = (log.match(/finished shutting down/g) || []).length;
    assert.equal(evidence.cleanSdkShutdowns, 5);
    fs.writeFileSync(path.join(evidenceDirectory, 'result.json'), JSON.stringify(evidence, null, 2) + '\n');
  } finally {
    if (client) client.close();
    if (mainClient) mainClient.close();
    if (feed) feed.close();
    // The hosted VM is discarded after the job. Do not use broad taskkill or
    // uninstall commands that could hide a failed lifecycle assertion.
    closeHub();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
