/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const asar = require('@electron/asar');
const yaml = require('js-yaml');
const pkg = require('../package.json');
const candidate = require('./sdk-candidate.json');
const source = require('../release-source.json');

const linux = process.platform === 'linux';
const output = path.resolve(__dirname, linux ? '../dist/ng-linux' : '../dist/ng');
const unpacked = path.join(output, linux ? 'linux-unpacked' : 'win-unpacked');
const resources = path.join(unpacked, 'resources');
const digest = (bytes, algorithm = 'sha256', encoding = 'hex') =>
  crypto.createHash(algorithm).update(bytes).digest(encoding);
const sdk = path.join(resources, 'static/daemon', linux ? 'lbrynet' : 'lbrynet.exe');
assert.equal(digest(fs.readFileSync(sdk)), candidate.artifacts[process.platform].sha256);
if (linux) assert(fs.statSync(sdk).mode & 0o111, 'Bundled SDK must be executable');
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(unpacked, 'SDK-CANDIDATE.json'), 'utf8')), candidate);
const archive = path.join(resources, 'app.asar');
const bundled = JSON.parse(asar.extractFile(archive, 'package.json'));
assert.equal(bundled.name, pkg.name);
assert.equal(bundled.version, pkg.version);
assert.equal(bundled.main, 'main.js');
const entries = new Set(asar.listPackage(archive).map((entry) => entry.replace(/\\/g, '/')));
assert(![...entries].some((entry) => entry.endsWith('.node')), 'Native addons need a separate Electron ABI review');
assert.deepEqual(
  asar.extractFile(archive, 'licenses/electron-cookies.LICENSE'),
  fs.readFileSync(path.join(__dirname, '../ui/util/electron-cookies.LICENSE'))
);
for (const name of ['@electron/remote', '@meetfranz/electron-cookies', 'electron-dl', 'tempy', 'sudo-prompt']) {
  assert(!entries.has('/node_modules/' + name + '/package.json'), 'Removed dependency shipped: ' + name);
}
for (const name of [
  'electron',
  'electron-builder',
  'electron-updater-legacy',
  '@electron/asar',
  'webpack',
  'express',
  'jsqr',
]) {
  assert(!entries.has('/node_modules/' + name + '/package.json'), 'Development package shipped: ' + name);
}
const packagedUpdater = JSON.parse(
  asar.extractFile(archive, path.join('node_modules', 'electron-updater', 'package.json'))
);
assert.equal(packagedUpdater.version, pkg.dependencies['electron-updater']);
assert(entries.has('/node_modules/electron-updater/out/providers/GitHubProvider.js'));
for (const entry of ['main.js', 'preload.js', 'ui.js', 'index.html']) {
  assert(asar.extractFile(archive, entry).length > 0, 'Missing packaged entry: ' + entry);
}
for (const name of ['worker-bundle.js', 'libarchive.wasm']) {
  assert.deepEqual(
    asar.extractFile(archive, 'webworkers/' + name),
    fs.readFileSync(path.resolve('node_modules/libarchive.js/dist', name)),
    'Archive worker and WASM must match the pinned decoder'
  );
}
assert(!entries.has('/webworkers/wasm-gen/libarchive.wasm'), 'Do not ship the obsolete comic decoder');
// Windows uses electron-updater. Linux updates are manual, so its unpacked
// directory need not contain the NSIS updater configuration.
if (!linux) {
  const updater = yaml.load(fs.readFileSync(path.join(resources, 'app-update.yml'), 'utf8'));
  for (const [key, value] of Object.entries(source)) assert.equal(updater[key], value);
}
const manifest = yaml.load(fs.readFileSync(path.join(output, linux ? 'latest-linux.yml' : 'latest.yml'), 'utf8'));
assert.equal(manifest.version, pkg.version);
assert(manifest.files.length > 0);
for (const file of manifest.files) {
  assert.equal(path.basename(file.url), file.url, 'Update asset must be a local filename');
  const bytes = fs.readFileSync(path.join(output, file.url));
  assert.equal(bytes.length, file.size);
  assert.equal(digest(bytes, 'sha512', 'base64'), file.sha512, 'Update digest must match the built package');
}
if (linux) assert(fs.existsSync(path.join(output, `LBRY-Desktop-NG-${pkg.version}-linux-x64.tar.gz`)));
const evidence = {
  version: pkg.version,
  platform: process.platform,
  sdk: candidate,
  assets: fs
    .readdirSync(output)
    .filter((name) => /\.(exe|AppImage|tar\.gz|yml|blockmap)$/.test(name))
    .map((name) => {
      const bytes = fs.readFileSync(path.join(output, name));
      return { name, size: bytes.length, sha256: digest(bytes) };
    }),
};
fs.mkdirSync(path.resolve(__dirname, '../dist/ci'), { recursive: true });
fs.writeFileSync(path.resolve(__dirname, '../dist/ci/package.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log('PASS: packaged entry points, SDK pin, application identity and updater asset digests');
if (!linux) {
  const guard = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'testInstaller.js')], {
    stdio: 'inherit',
  });
  if (guard.error) throw guard.error;
  assert.equal(guard.status, 0, 'The installer must reject unsupported Windows before replacing files');
  const result = require('child_process').spawnSync(
    process.execPath,
    [path.join(__dirname, 'testDesktopUpdates.js'), '--built-metadata'],
    {
      stdio: 'inherit',
    }
  );
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'Released and current updaters must read the generated metadata');
}
