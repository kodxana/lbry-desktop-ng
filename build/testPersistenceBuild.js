/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { transformSync } = require('@babel/core');
const { load } = require('./testStartup');
const conditionalLoader = require('./conditionalLoader.cjs');
const { preprocess } = conditionalLoader;

function conditions() {
  const source = [
    '// @flow',
    "// @if TARGET='app'",
    'const target = "desktop";',
    "// @if CUSTOM_HOMEPAGE='true'",
    'const homepage = "custom";',
    '// @else',
    'const homepage = "default";',
    '// @ENDIF',
    '// @else',
    'const target = "web";',
    '// @endif',
    '// @if process.env.DEBUG_TILE_RENDER',
    'debugOnly();',
    '// @endif',
  ].join('\r\n');
  for (const TARGET of ['app', 'web'])
    for (const CUSTOM_HOMEPAGE of ['false', 'true']) {
      const result = preprocess(source, { TARGET, CUSTOM_HOMEPAGE });
      assert.equal(result.split('\r\n').length, source.split('\r\n').length, 'Keep source locations for Babel');
      assert(result.includes('// @flow'));
      assert(result.includes(TARGET === 'app' ? '"desktop"' : '"web"'));
      assert(!result.includes(TARGET === 'app' ? '"web"' : '"desktop"'));
      assert.equal(result.includes('"custom"'), TARGET === 'app' && CUSTOM_HOMEPAGE === 'true');
      assert.equal(result.includes('"default"'), TARGET === 'app' && CUSTOM_HOMEPAGE === 'false');
      assert(!result.includes('debugOnly'));
    }
  const jsx = [
    'const view = <div>',
    "{/* @if TARGET='app' */}",
    '<button>Back up wallet</button>',
    '{/* @else */}',
    '<a>Web</a>',
    '{/* @endif */}',
    '</div>;',
  ].join('\n');
  const compile = (text) =>
    transformSync(text, {
      babelrc: false,
      configFile: false,
      presets: [['@babel/preset-react', { runtime: 'automatic', development: false }]],
    }).code;
  assert.match(compile(preprocess(jsx, { TARGET: 'app' })), /Back up wallet/);
  assert(!compile(preprocess(jsx, { TARGET: 'web' })).includes('Back up wallet'));
  assert.equal(
    preprocess('/* ordinary comment */\n@include font-sans;\n// @param value', {}),
    '/* ordinary comment */\n@include font-sans;\n// @param value'
  );
  for (const invalid of [
    "const view = <div>{/* @if TARGET='app' */}<span />{/* @endif */}</div>;",
    '// @else',
    '// @endif',
    '// @endif extra',
    "// @if TARGET='app'\nmissingEnd();",
    "// @if TARGET='app'\n// @else\n// @else\n// @endif",
    '// @if globalThis.sideEffect()\nrun();\n// @endif',
    '// @include private-file',
    '// @exec arbitrary()',
    '// @echo SECRET',
  ])
    assert.throws(() => preprocess(invalid, { TARGET: 'app' }), /Unexpected|Missing|Duplicate|Unsupported/);
  let cached = false;
  assert(preprocess(source, { TARGET: 'app' }).includes('"default"'));
  assert.equal(
    conditionalLoader.call(
      {
        cacheable: () => {
          cached = true;
        },
        getOptions: () => ({ TARGET: 'app', CUSTOM_HOMEPAGE: 'false' }),
      },
      source
    ),
    preprocess(source, { TARGET: 'app', CUSTOM_HOMEPAGE: 'false' })
  );
  assert(cached);
  // Check every source directive stays within the supported build grammar.
  const roots = ['ui', 'electron', 'extras', 'custom', 'homepages'];
  let checked = 0;
  for (const directory of roots) {
    for (const file of fs.readdirSync(path.resolve(__dirname, '..', directory), { recursive: true })) {
      if (!/\.jsx?$/.test(file)) continue;
      const filename = path.resolve(__dirname, '..', directory, file);
      if (!fs.statSync(filename).isFile()) continue;
      const text = fs.readFileSync(filename, 'utf8');
      if (!/(?:\/\/|\/\*)\s*@if\b/i.test(text)) continue;
      for (const CUSTOM_HOMEPAGE of ['false', 'true']) preprocess(text, { TARGET: 'app', CUSTOM_HOMEPAGE });
      checked++;
    }
  }
  assert(checked > 0);
  console.log(
    'PASS conditional loader: nested JS/JSX branches, uppercase markers, line locations, errors and ' +
      checked +
      ' source modules'
  );
}

function compression() {
  const createCompressor = load('util/persist-compressor.js', {
    'lz-string': require('lz-string'),
    'json-stringify-safe': require('json-stringify-safe'),
  }).default;
  const codec = createCompressor();
  const cases = require('./tests/fixtures/codec-cases.cjs')();
  const golden = require('./tests/fixtures/persist-codec-v4.json');
  assert.deepEqual(
    cases.map(([name]) => name),
    golden.cases.map(({ name }) => name)
  );
  for (const [index, [name, state]] of cases.entries()) {
    const before = require('json-stringify-safe')(state);
    const encoded = codec.in(state, name);
    assert.equal(
      Buffer.from(encoded, 'utf16le').toString('base64'),
      golden.cases[index].encoded,
      name + ': legacy bytes must be unchanged'
    );
    assert.equal(
      JSON.stringify(codec.out(encoded, name)),
      JSON.stringify(golden.cases[index].decoded),
      name + ': legacy decode'
    );
    assert.equal(require('json-stringify-safe')(state), before, name + ': persistence must not mutate state');
  }
  const fixture = require('./tests/fixtures/persist-v0.json');
  const stored = JSON.parse(fixture.serialized);
  for (const [key, expected] of Object.entries(fixture.expected)) {
    assert.equal(
      JSON.stringify(codec.out(JSON.parse(stored[key]), key)),
      JSON.stringify(expected),
      'Published RC state: ' + key
    );
  }
  for (const value of [undefined, null, false, 3, { unchanged: true }]) assert.equal(codec.out(value), value);
  for (const bad of ['', 'not compressed', require('lz-string').compressToUTF16('not json')])
    assert.equal(codec.out(bad), null);
  assert.throws(() => codec.in({ unsupported: 1n }), /BigInt/);
  console.log(
    'PASS persistence codec: exact 1.4.4 bytes, published RC data, Unicode, cycles, nulls and malformed values'
  );
}

conditions();
compression();
