/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repository = path.resolve(__dirname, '..');
const output = path.join(repository, 'dist/build-helper-tests');
fs.mkdirSync(output, { recursive: true });
const root = fs.mkdtempSync(path.join(output, 'config with spaces-'));
const child = path.join(root, 'read config.cjs');
fs.writeFileSync(
  child,
  `
  const config = require(process.argv[2]);
  console.log(JSON.stringify({
    port: config.WEBPACK_ELECTRON_PORT,
    title: config.SITE_TITLE,
    color: config.LOADING_BAR_COLOR,
    channels: config.AUTO_FOLLOW_CHANNELS,
    custom: config.CUSTOM_HOMEPAGE,
    mode: process.env.NODE_ENV,
    value: process.env.LBRY_BUILD_HELPER_VALUE,
  }));
  process.exitCode = Number(process.env.LBRY_BUILD_HELPER_EXIT || 0);
`
);
const env = { ...process.env };
for (const key of [
  'WEBPACK_ELECTRON_PORT',
  'SITE_TITLE',
  'LOADING_BAR_COLOR',
  'AUTO_FOLLOW_CHANNELS',
  'CUSTOM_HOMEPAGE',
  'LBRY_BUILD_HELPER_VALUE',
  'LBRY_BUILD_HELPER_EXIT',
]) {
  delete env[key];
}
const configPath = path.join(repository, 'config.js');
const run = (cwd, overrides = {}, args = [child, configPath]) => {
  const result = spawnSync(process.execPath, args, {
    cwd,
    env: { ...env, ...overrides },
    encoding: 'utf8',
    timeout: 30000,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, Number(overrides.LBRY_BUILD_HELPER_EXIT || 0), result.stderr);
  return JSON.parse(result.stdout.trim());
};

// Both the host config and Webpack must preserve the same checked-in defaults.
fs.copyFileSync(path.join(repository, '.env.defaults'), path.join(root, '.env.defaults'));
const defaults = run(root);
assert.equal(defaults.port, '9091');
assert.equal(defaults.title, 'LBRY');
assert.equal(defaults.color, '#2bbb90');
assert.equal(defaults.channels, 'lbry://@lbry#3fda836a92faaceedfe398225fb9b2ee2ed1f01a');
assert.equal(defaults.custom, false);
const pluginDefaults = require('dotenv-webpack');
const plugin = new pluginDefaults({
  path: path.join(root, '.env'),
  defaults: path.join(root, '.env.defaults'),
  silent: true,
});
const variables = plugin.gatherVariables();
assert.equal(variables.LOADING_BAR_COLOR, defaults.color);
assert.equal(variables.AUTO_FOLLOW_CHANNELS, defaults.channels);

fs.writeFileSync(
  path.join(root, '.env'),
  [
    'WEBPACK_ELECTRON_PORT=9199',
    'SITE_TITLE="Community ł # desktop"',
    'LOADING_BAR_COLOR=',
    'AUTO_FOLLOW_CHANNELS="lbry://@fixture#123"',
    'CUSTOM_HOMEPAGE=true',
  ].join('\n')
);
const local = run(root);
assert.equal(local.port, '9199');
assert.equal(local.title, 'Community ł # desktop');
assert.equal(local.color, '', 'An explicit empty value must not fall back to the default');
assert.equal(local.channels, 'lbry://@fixture#123');
assert.equal(local.custom, true);
const inherited = run(root, { SITE_TITLE: 'Host title', LOADING_BAR_COLOR: '', CUSTOM_HOMEPAGE: 'false' });
assert.equal(inherited.title, 'Host title');
assert.equal(inherited.color, '');
assert.equal(inherited.custom, false);
const empty = path.join(root, 'missing env');
fs.mkdirSync(empty);
assert.equal(run(empty).port, undefined, 'Missing optional config files must not fail startup');

for (const mode of ['production', 'development']) {
  const result = run(root, {}, [
    path.join(repository, '.yarn/releases/yarn-4.18.1.cjs'),
    'crossenv',
    'NODE_ENV=' + mode,
    'LBRY_BUILD_HELPER_VALUE=build ł value',
    process.execPath,
    child,
    configPath,
  ]);
  assert.equal(result.mode, mode);
  assert.equal(result.value, 'build ł value');
}
run(root, { LBRY_BUILD_HELPER_EXIT: '37' }, [
  path.join(repository, '.yarn/releases/yarn-4.18.1.cjs'),
  'crossenv',
  process.execPath,
  child,
  configPath,
]);
console.log('PASS: config defaults, quoted hashes, empty values, host overrides and cross-env commands/exit codes');
