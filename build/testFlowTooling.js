/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const parent = path.join(root, 'dist', 'flow-tests');
fs.mkdirSync(parent, { recursive: true });
const cwd = fs.mkdtempSync(path.join(parent, 'types space-ą-'));
const write = (file, content) => {
  const target = path.join(cwd, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
};
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
  if (result.error) throw result.error;
  assert.equal(result.signal, null, result.stderr);
  return result;
};
const flow = require('flow-bin');
const check = () => {
  const result = run(flow, ['full-check', '--max-workers', '2', '--json', '--strip-root']);
  assert([0, 2].includes(result.status), result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.flowVersion, require('../package.json').devDependencies['flow-bin']);
  assert.equal(report.passed, result.status === 0);
  return report;
};
write('.flowconfig', fs.readFileSync(path.join(root, '.flowconfig'), 'utf8'));
write('flow-typed/Settings.js', fs.readFileSync(path.join(root, 'flow-typed/Settings.js'), 'utf8'));
write('package.json', JSON.stringify({ name: 'flow-fixture', devDependencies: { 'flow-bin': '0.337.0' } }));
write('ui/util/storage.js', '// @flow\nexport function freeBytes(disk: DiskSpace): number { return disk.free; }\n');
write('extras/lbryinc/index.js', '// @flow\nexport const clientName: string = "fixture";\n');
write('configValues.js', '// @flow\nexport const enabled: boolean = true;\n');
const valid = `// @flow
  import * as React from 'react';
  import { freeBytes } from 'util/storage';
  import { clientName } from 'lbryinc';
  import { enabled } from 'config';
  export function DiskLabel({ disk }: { disk?: DiskSpace }): React.Node {
    const bytes: number = disk ? freeBytes(disk) : 0;
    return <span title={clientName}>{enabled ? (disk?.total ?? bytes) : 0}</span>;
  }
  export const available: number = freeBytes({ total: 100, free: 50 });
`;
write('ui/view.jsx', valid);
// These generated directories must not become application input or load cached libdefs.
write('dist/invalid.js', '// @flow\nconst broken = ;\n');
write('.yarn/flow-typed/invalid.js', '// @flow\nconst broken = ;\n');
assert.deepEqual(check().errors, [], 'JSX, global types, optional chaining and desktop aliases must type-check');
write('ui/view.jsx', valid.replace('free: 50', 'free: "50"'));
const invalid = check();
assert.equal(invalid.passed, false, 'Incorrect application property types must fail the check');
assert(invalid.errors.some((error) => error.error_codes.includes('incompatible-type')));
write('ui/view.jsx', '// @flow\nconst broken = ;\n');
assert.equal(check().passed, false, 'Invalid source syntax must fail the check');

// Exercise the public definition CLI offline; hand-written definitions must survive regeneration.
const definitions = (...args) => run(process.execPath, [require.resolve('flow-typed/dist/cli.js'), ...args]);
write('node_modules/fixture-module/package.json', JSON.stringify({ name: 'fixture-module', version: '1.0.0' }));
write('node_modules/fixture-module/index.js', 'module.exports = function (value) { return String(value); };\n');
const created = definitions('create-stub', 'fixture-module');
assert.equal(created.status, 0, created.stdout + created.stderr);
const stub = path.join(cwd, 'flow-typed/npm/fixture-module_vx.x.x.js');
assert.match(fs.readFileSync(stub, 'utf8'), /declare module 'fixture-module'/);
const custom = "declare module 'fixture-module' { declare module.exports: (value: number) => string; }\n";
fs.writeFileSync(stub, custom);
const repeated = definitions('create-stub', 'fixture-module');
assert.equal(repeated.status, 1, repeated.stdout + repeated.stderr);
assert.match(repeated.stdout + repeated.stderr, /already exists and has been modified/);
assert.equal(fs.readFileSync(stub, 'utf8'), custom);
write('ui/view.jsx', "// @flow\nimport format from 'fixture-module';\nexport const result: string = format(50);\n");
assert.deepEqual(check().errors, [], 'The checked-in custom definition must be used');
write('ui/view.jsx', "// @flow\nimport format from 'fixture-module';\nexport const result: string = format('50');\n");
assert.equal(check().passed, false, 'Incorrect calls through a custom definition must fail');
console.log('PASS Flow CLI types, errors, aliases, ignored outputs and definition preservation');
