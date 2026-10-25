/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const manifest = require('../package.json');
const version = manifest.engines.yarn;
const cli = path.join(root, '.yarn/releases/yarn-' + version + '.cjs');
const parent = path.join(root, 'dist/package-manager-tests');
fs.mkdirSync(parent, { recursive: true });
const cwd = fs.mkdtempSync(path.join(parent, 'install space-ą-'));
const run = (...args) => {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 60000,
    windowsHide: true,
    env: { ...process.env, YARN_ENABLE_IMMUTABLE_INSTALLS: 'false' },
  });
  if (result.error) throw result.error;
  assert.equal(result.signal, null, result.stderr);
  return result;
};
const success = (...args) => {
  const result = run(...args);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
};
assert.equal(manifest.packageManager, 'yarn@' + version);
assert.equal(success('--version').trim(), version);
assert.match(fs.readFileSync(path.join(root, '.yarnrc.yml'), 'utf8'), new RegExp('yarn-' + version + '\\.cjs'));
assert.match(success('plugin', 'runtime'), /@yarnpkg\/plugin-version/);

fs.writeFileSync(path.join(cwd, '.yarnrc.yml'), 'nodeLinker: node-modules\n');
fs.writeFileSync(path.join(cwd, 'yarn.lock'), '');
fs.mkdirSync(path.join(cwd, 'fixture'));
fs.writeFileSync(
  path.join(cwd, 'fixture/package.json'),
  JSON.stringify({ name: 'local-fixture', version: '1.0.0', main: 'index.js' })
);
fs.writeFileSync(path.join(cwd, 'fixture/index.js'), 'module.exports = "local fixture";\n');
const fixture = {
  name: 'package-manager-fixture',
  private: true,
  packageManager: manifest.packageManager,
  dependencies: { 'local-fixture': 'file:./fixture' },
  scripts: { postinstall: "node -e \"require('fs').writeFileSync('lifecycle-ran', 'unexpected')\"" },
};
const save = () => fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify(fixture));
save();
success('install', '--mode=skip-build');
assert.equal(require(path.join(cwd, 'node_modules/local-fixture')), 'local fixture');
assert(!fs.existsSync(path.join(cwd, 'lifecycle-ran')), 'The install must skip the root lifecycle script');
const lockfile = path.join(cwd, 'yarn.lock');
const lock = fs.readFileSync(lockfile, 'utf8');
success('install', '--immutable', '--mode=skip-build');
assert.equal(fs.readFileSync(lockfile, 'utf8'), lock);
fixture.dependencies['another-fixture'] = 'file:./fixture';
save();
const changed = run('install', '--immutable', '--mode=skip-build');
assert.notEqual(changed.status, 0, 'An out-of-date lockfile must fail immutable installs');
assert.match(changed.stdout + changed.stderr, /YN0028/);
assert.equal(fs.readFileSync(lockfile, 'utf8'), lock, 'A failed immutable install must preserve the lockfile');
assert(!fs.existsSync(path.join(cwd, 'lifecycle-ran')));
console.log(
  'PASS pinned Yarn, bundled plugins, local dependency installs, skipped lifecycle scripts and immutable locks'
);
