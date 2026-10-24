/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ESLint } = require('eslint');
const prettier = require('prettier');

const root = path.resolve(__dirname, '..');

async function main() {
  const eslint = new ESLint({ cwd: root });
  const lint = async (source, filePath = 'ui/lint-fixture.jsx') =>
    (await eslint.lintText(source, { filePath }))[0].messages.filter((message) => message.severity === 2);
  assert.deepEqual(
    await lint(`// @flow
      import React from 'react';
      type Props = { claim: Claim, label?: string };
      export default function Preview({ claim, label }: Props) {
        return <span>{label ?? claim?.name}</span>;
      }
    `),
    [],
    'Flow types, global SDK types, JSX and modern syntax remain lintable'
  );
  assert((await lint('export const value = missingRuntimeValue;')).some((m) => m.ruleId === 'no-undef'));
  assert((await lint('const unused = 1;')).some((m) => m.ruleId === 'no-unused-vars'));
  assert((await lint('export const value = ;')).some((m) => m.fatal));
  assert(
    (
      await lint(`import { useState } from 'react';
      export function Bad() { if (window.enabled) useState(0); return null; }
    `)
    ).some((m) => m.ruleId === 'react-hooks/rules-of-hooks')
  );
  assert.deepEqual(await lint("module.exports = require('path').join('a', 'b');", 'electron/lint-fixture.cjs'), []);
  assert(await eslint.isPathIgnored(path.join(root, 'dist/generated.js')));
  assert(await eslint.isPathIgnored(path.join(root, 'flow-typed/npm/fixture.js')));

  const options = await prettier.resolveConfig(path.join(root, 'ui/lint-fixture.jsx'));
  assert.equal(options.trailingComma, 'es5');
  const modernFlow = await prettier.format(
    'type Keys = keyof {name: string}; export function identity<T extends { ... }>(value: T): T { return value; }',
    { ...options, filepath: 'ui/lint-fixture.jsx' }
  );
  assert.match(modernFlow, /keyof/);
  assert.match(modernFlow, /T extends/);
  assert(await prettier.check(modernFlow, { ...options, filepath: 'ui/lint-fixture.jsx' }));
  for (const [parser, input] of [
    ['babel-flow', 'export const value:number=1'],
    ['scss', '.fixture {color:red;}'],
    ['json', '{"value":1}'],
  ]) {
    const formatted = await prettier.format(input, { ...options, parser });
    assert(await prettier.check(formatted, { ...options, parser }));
  }

  // Exercise real commits in a throwaway repository, including partially staged edits.
  const parent = path.join(root, 'dist', 'lint-tests');
  fs.mkdirSync(parent, { recursive: true });
  const cwd = fs.mkdtempSync(path.join(parent, 'hooks space-ą-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
  Object.assign(env, {
    HUSKY: '1',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: path.join(cwd, 'absent-gitconfig'),
    XDG_CONFIG_HOME: path.join(cwd, 'config'),
    YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
  });
  const run = (command, args, success = true) => {
    const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: 30000 });
    if (result.error) throw result.error;
    if (success) assert.equal(result.status, 0, result.stdout + result.stderr);
    else assert.notEqual(result.status, 0, 'Invalid staged code must prevent the commit');
    return result.stdout + result.stderr;
  };
  const git = (...args) => run('git', args);
  const write = (file, text) => fs.writeFileSync(path.join(cwd, file), text);
  const read = (file) => fs.readFileSync(path.join(cwd, file), 'utf8');
  git('init', '--quiet');
  git('config', 'user.name', 'Hook test');
  git('config', 'user.email', 'hook-test@example.invalid');
  git('config', 'core.autocrlf', 'false');
  fs.mkdirSync(path.join(cwd, '.husky'));
  fs.mkdirSync(path.join(cwd, 'ui'));
  fs.mkdirSync(path.join(cwd, 'electron'));
  fs.mkdirSync(path.join(cwd, '.yarn', 'releases'), { recursive: true });
  for (const file of [
    'eslint.config.cjs',
    '.prettierrc.json',
    '.lintstagedrc.json',
    '.husky/pre-commit',
    '.yarn/releases/yarn-4.18.1.cjs',
  ]) {
    fs.copyFileSync(path.join(root, file), path.join(cwd, file));
  }
  write('.yarnrc.yml', 'nodeLinker: node-modules\n');
  write('yarn.lock', '');
  write(
    'package.json',
    JSON.stringify({
      name: 'lint-hook-fixture',
      private: true,
      scripts: {
        precommit: require('../package.json').scripts.precommit.replace(
          'lint-staged',
          `node "${require.resolve('lint-staged/bin').replace(/\\/g, '/')}"`
        ),
      },
    })
  );
  run(process.execPath, ['.yarn/releases/yarn-4.18.1.cjs', 'install', '--mode=skip-build']);
  write('.gitignore', 'node_modules/\n.yarn/\n.husky/_/\n');
  write('ui/partly staged.js', 'export const staged = 1;\n\nexport const unfinished = 1;\n');
  write('electron/service.cjs', "module.exports = 'old';\n");
  git('add', '.');
  git('-c', 'core.hooksPath=.no-hooks', 'commit', '--quiet', '-m', 'Initial fixture');
  run(process.execPath, [path.join(root, 'node_modules/husky/bin.js')]);
  assert.equal(git('config', 'core.hooksPath').trim(), '.husky/_');

  write('ui/partly staged.js', 'export const staged=2\n\nexport const unfinished = 1;\n');
  write('electron/service.cjs', "module.exports='new'\n");
  git('add', 'ui/partly staged.js', 'electron/service.cjs');
  write('ui/partly staged.js', 'export const staged=2\n\nexport const unfinished = 9;\n');
  git('commit', '--quiet', '-m', 'Format only staged edits');
  assert.equal(git('show', 'HEAD:ui/partly staged.js'), 'export const staged = 2;\n\nexport const unfinished = 1;\n');
  assert.equal(read('ui/partly staged.js'), 'export const staged = 2;\n\nexport const unfinished = 9;\n');
  assert.equal(git('show', 'HEAD:electron/service.cjs'), "module.exports = 'new';\n");
  assert.equal(git('diff', '--cached'), '');

  // Yarn's Windows command shim has a smaller limit than CreateProcess.
  fs.mkdirSync(path.join(cwd, 'ui', 'large-batch'));
  const batch = Array.from({ length: 80 }, (_, index) => `ui/large-batch/${index}-${'long-name-'.repeat(6)}.js`);
  assert(batch.map((file) => path.join(cwd, file)).join(' ').length > 8191);
  for (const file of batch) write(file, 'export const value=1\n');
  git('add', 'ui/large-batch');
  git('commit', '--quiet', '-m', 'Format a large staged batch');
  for (const file of batch) assert.equal(git('show', 'HEAD:' + file), 'export const value = 1;\n');
  assert.equal(read('ui/partly staged.js'), 'export const staged = 2;\n\nexport const unfinished = 9;\n');

  write('ui/bad.js', 'export const broken=missingRuntimeValue\n');
  git('add', 'ui/bad.js');
  const head = git('rev-parse', 'HEAD');
  const index = git('diff', '--cached');
  const working = git('diff');
  assert.match(run('git', ['commit', '--quiet', '-m', 'Must fail'], false), /no-undef/);
  assert.equal(git('rev-parse', 'HEAD'), head);
  assert.equal(git('diff', '--cached'), index, 'A failed hook restores the original index');
  assert.equal(git('diff'), working, 'A failed hook preserves unfinished edits');
  assert.equal(read('ui/bad.js'), 'export const broken=missingRuntimeValue\n');
  assert.equal(git('stash', 'list'), '', 'Hooks leave no temporary stash behind');
  console.log('Lint, Flow/JSX, formatting, real commit hooks, partial staging and failed-commit restoration passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
