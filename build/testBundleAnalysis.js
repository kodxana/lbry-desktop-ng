/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { spawnSync } = require('child_process');
const explorerRequire = createRequire(require.resolve('source-map-explorer'));
const { SourceMapGenerator } = explorerRequire('source-map');
const output = path.join(__dirname, '../dist/analysis-tests');
fs.mkdirSync(output, { recursive: true });
const root = fs.mkdtempSync(path.join(output, 'maps ł '));
const first = "const one = 'ł';";
const second = 'const two = 2;';
function bundle(name, line = 1, column = first.length) {
  const file = path.join(root, name + '.js');
  const map = new SourceMapGenerator({ file: name + '.js' });
  map.addMapping({ generated: { line: 1, column: 0 }, original: { line: 1, column: 0 }, source: 'one-ł.js' });
  map.addMapping({ generated: { line, column }, original: { line: 1, column: 0 }, source: 'two.js' });
  map.setSourceContent('one-ł.js', first);
  map.setSourceContent('two.js', second);
  fs.writeFileSync(file, first + second + '\n//# sourceMappingURL=' + name + '.js.map\n');
  fs.writeFileSync(file + '.map', map.toString());
  return file;
}
function run(file, args = ['--json']) {
  return spawnSync(process.execPath, [require.resolve('source-map-explorer/bin/cli.js'), file, ...args], {
    encoding: 'utf8',
    timeout: 30000,
  });
}
const file = bundle('valid');
const result = run(file);
assert.equal(result.status, 0, result.stderr);
const report = JSON.parse(result.stdout).results[0];
const sourceName = encodeURI('one-ł.js');
assert.equal(report.files[sourceName].size, Buffer.byteLength(first));
assert.equal(report.files['two.js'].size, Buffer.byteLength(second));
assert.equal(report.mappedBytes, Buffer.byteLength(first + second));
const html = path.join(root, 'report.html');
const rendered = run(file, ['--only-mapped', '--html', html]);
assert.equal(rendered.status, 0, rendered.stderr);
assert(fs.readFileSync(html, 'utf8').includes(sourceName), 'HTML output must include the mapped source');
for (const [name, line, column, error] of [
  ['invalid-column', 1, 1000, /generated column/],
  ['invalid-line', 10, 0, /generated line/],
]) {
  const invalid = run(bundle(name, line, column));
  assert.notEqual(invalid.status, 0, 'Invalid maps must fail rather than produce misleading reports');
  assert.match(invalid.stderr, error);
}
console.log('PASS: bundle analysis maps UTF-8 bytes, writes HTML and rejects invalid source-map columns/lines');
