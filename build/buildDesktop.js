/* eslint no-console:0 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const nodeVersion = fs.readFileSync(path.join(__dirname, '../.node-version'), 'utf8').trim();
const prepareDaemon = require('./downloadDaemon');
const testBuild = process.env.LBRY_DESKTOP_BUILD === 'sdk-test';
const linux = process.platform === 'linux';
const configFile = testBuild
  ? 'electron-builder.sdk-test.json'
  : linux
  ? 'electron-builder.linux.json'
  : 'electron-builder.json';
const config = { ...require('../electron-builder.json'), ...require('../' + configFile) };
const settings = require(testBuild ? '../sdk-test.json' : '../desktop-settings.json');

if (!['win32', 'linux'].includes(process.platform) || process.arch !== 'x64' || process.versions.node !== nodeVersion) {
  throw new Error('Desktop packaging requires Windows or Linux x64 and Node ' + nodeVersion + '.');
}
if (testBuild && linux) {
  throw new Error('The separate SDK Test ZIP currently requires Windows. Use the NG build on Linux.');
}
if (config.appId !== settings.appId || config.productName !== settings.appName) {
  throw new Error('Desktop application identity mismatch.');
}
process.chdir(path.resolve(__dirname, '..'));
prepareDaemon();
for (const args of [
  ['build/testDesktopSetup.js'],
  ['build/testDesktopUpdates.js'],
  ['build/testUpdaterIpc.js'],
  ['build/testPasswordStorage.js'],
  ['build/testFileSelection.js'],
  ['build/testWindowControls.js'],
  ['build/testRendererLifecycle.js'],
  ['build/testContextMenu.js'],
  ['build/testDesktopInfo.js'],
  ['build/testWalletBackup.js'],
  ['build/testDesktopBridge.js'],
  ['build/testContentFiles.js'],
  ['build/testSdkIsolation.js'],
  ['--max_old_space_size=4096', 'node_modules/webpack/bin/webpack.js', '--config', 'webpack.electron.config.js'],
  [
    '.yarn/releases/yarn-3.2.0.cjs',
    'exec',
    'electron-builder',
    linux ? '--linux' : '--win',
    '--x64',
    '--publish',
    'never',
    '--config',
    configFile,
  ],
]) {
  const result = spawnSync(process.execPath, args, {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production', CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
