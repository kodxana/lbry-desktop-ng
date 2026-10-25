/* eslint no-console:0 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const assert = require('assert').strict;

process.chdir(path.resolve(__dirname, '..'));
// Player components and plugins must share constructors and the plugin registry.
for (const plugin of ['@videojs/http-streaming', 'videojs-contrib-quality-levels']) {
  assert.equal(
    require.resolve('video.js', { paths: [path.dirname(require.resolve(plugin))] }),
    require.resolve('video.js'),
    plugin + ' must use the application Video.js instance'
  );
}
for (const module of [
  '@codemirror/view',
  '@codemirror/commands',
  '@codemirror/language',
  '@codemirror/lang-markdown',
]) {
  assert.equal(
    require.resolve('@codemirror/state', { paths: [path.dirname(require.resolve(module))] }),
    require.resolve('@codemirror/state'),
    module + ' must share the editor state constructors'
  );
}
const output = path.resolve('dist/renderer-tests');
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(path.join(output, 'webworkers'), { recursive: true });
for (const name of ['worker-bundle.js', 'libarchive.wasm']) {
  fs.copyFileSync(path.resolve('node_modules/libarchive.js/dist', name), path.join(output, 'webworkers', name));
}
fs.mkdirSync(path.resolve('dist/ci'), { recursive: true });
fs.writeFileSync(
  path.join(output, 'index.html'),
  '<!doctype html><meta charset="utf-8"><div id="app"></div><script src="renderer.js"></script>'
);

for (const [command, args] of [
  [process.execPath, ['node_modules/webpack/bin/webpack.js', '--config', 'build/tests/webpack.config.js']],
  [require('electron'), ['build/tests/electron.cjs']],
  [require('electron'), ['build/tests/electron.cjs', '--comics']],
  [require('electron'), ['build/tests/electron.cjs', '--three']],
  [require('electron'), ['build/tests/sandbox.cjs']],
  [require('electron'), ['build/tests/devtools.cjs']],
  [require('electron'), ['build/tests/devtools.cjs', '--failure']],
]) {
  const env = { ...process.env, NODE_ENV: 'production' };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(command, args, {
    env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: 180000,
    windowsHide: true,
  });
  const log = (result.stdout || '') + (result.stderr || '');
  fs.writeFileSync(
    path.resolve(
      'dist/ci',
      command === process.execPath
        ? 'renderer-build.log'
        : args.includes('--comics')
          ? 'comic-tests.log'
          : args.includes('--three')
            ? 'three-tests.log'
            : args[0].endsWith('sandbox.cjs')
              ? 'sandbox-tests.log'
              : args[0].endsWith('devtools.cjs')
                ? 'devtools' + (args.includes('--failure') ? '-failure' : '') + '-tests.log'
                : 'renderer-tests.log'
    ),
    log
  );
  process.stdout.write(log);
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
