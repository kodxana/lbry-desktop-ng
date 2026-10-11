/* eslint no-console:0 */
const { spawnSync } = require('child_process');
const path = require('path');
const prepareDaemon = require('./downloadDaemon');
const config = require('../electron-builder.sdk-test.json');
const settings = require('../sdk-test.json');

if (process.platform !== 'win32' || process.arch !== 'x64' || process.versions.node !== '16.20.2') {
  throw new Error('This desktop test build uses Windows x64 and Node 16.20.2.');
}
if (config.appId !== settings.appId || config.productName !== settings.appName) {
  throw new Error('Test application identity mismatch.');
}
process.chdir(path.resolve(__dirname, '..'));
prepareDaemon();
for (const args of [
  ['build/testSdkIsolation.js'],
  ['--max_old_space_size=4096', 'node_modules/webpack/bin/webpack.js', '--config', 'webpack.electron.config.js'],
  ['node_modules/electron-builder/out/cli/cli.js', '--win', '--x64', '--publish', 'never',
    '--config', 'electron-builder.sdk-test.json'],
]) {
  const result = spawnSync(process.execPath, args, {
    stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production', CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
