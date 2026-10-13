/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');

const output = path.resolve(__dirname, '../dist/translation-tests');
fs.mkdirSync(output, { recursive: true });
const directory = fs.mkdtempSync(path.join(output, 'messages-'));
const messagesFile = path.join(directory, 'app-strings.json');
const source = path.resolve(__dirname, '../static/app-strings.json');
const original = fs.readFileSync(source);
fs.writeFileSync(messagesFile, original);
const { code } = babel.transformFileSync(path.resolve(__dirname, '../ui/i18n.js'), {
  configFile: false,
  babelrc: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});

function load(mode = 'development') {
  const context = {
    require,
    exports: {},
    process: { env: { NODE_ENV: mode, LBRY_I18N_OUTPUT_FILE: messagesFile } },
    window: { localStorage: { getItem: () => 'en' } },
  };
  vm.runInNewContext(code, context);
  return context.exports.__;
}

let translate = load();
const expected = JSON.parse(original);
for (let index = 0; index < 100; index++) {
  const message = 'Collected message ' + index + ' ł --[test context]--';
  expected[message] = 'Collected message ' + index + ' ł';
  assert.equal(translate(message), expected[message]);
}
assert.deepEqual(JSON.parse(fs.readFileSync(messagesFile, 'utf8')), expected);

// A fresh renderer must be able to read the previous collection immediately.
translate = load();
translate('Collected after reload');
expected['Collected after reload'] = 'Collected after reload';
assert.deepEqual(JSON.parse(fs.readFileSync(messagesFile, 'utf8')), expected);
assert.equal(Object.keys(JSON.parse(fs.readFileSync(messagesFile, 'utf8'))).pop(), '--end--');

const collected = fs.readFileSync(messagesFile);
translate('Collected after reload');
load('production')('Production must not collect this');
assert.deepEqual(fs.readFileSync(messagesFile), collected);
assert.deepEqual(fs.readFileSync(source), original, 'Collection must preserve source translations');
console.log('PASS: development translation collection survives rapid messages and renderer reloads');
