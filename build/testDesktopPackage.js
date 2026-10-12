/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const asar = require('asar');
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
for (const entry of ['main.js', 'ui.js', 'index.html']) {
  assert(asar.extractFile(archive, entry).length > 0, 'Missing packaged entry: ' + entry);
}
const updater = yaml.load(fs.readFileSync(path.join(resources, 'app-update.yml'), 'utf8'));
for (const [key, value] of Object.entries(source)) assert.equal(updater[key], value);
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
