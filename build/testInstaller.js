/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { getMakeNsisPath } = require('app-builder-lib/out/toolsets/windows');

// Compile the production initialization guard into a harmless test executable.
// Its only install action writes a marker in dist; it cannot alter an installed app.
async function main() {
  assert.equal(process.platform, 'win32');
  const parent = path.resolve(__dirname, '../dist/installer-tests');
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'guard-'));
  const compiler = await getMakeNsisPath();
  const quote = (value) => '"' + value.replace(/\$/g, '$$$$').replace(/"/g, '$\\"') + '"';
  const config = require('../electron-builder.json');
  const include = path.resolve(__dirname, '..', config.nsis.include);
  for (const [name, condition, expected] of [
    ['unsupported', '0 = 1', 1633],
    ['supported', '1 = 1', 0],
    ['native', null, 0],
  ]) {
    const executable = path.join(root, name + '.exe');
    const marker = path.join(root, name + '.txt');
    const script = path.join(root, name + '.nsi');
    fs.writeFileSync(
      script,
      `
!include "LogicLib.nsh"
!include "WinVer.nsh"
${condition ? '!undef AtLeastWin10\n!define AtLeastWin10 "' + condition + '"' : ''}
!include ${quote(include)}
Name "Desktop NG installer guard test"
OutFile ${quote(executable)}
RequestExecutionLevel user
ManifestSupportedOS all
SilentInstall silent
Function .onInit
  !insertmacro customInit
FunctionEnd
Section
  FileOpen $0 ${quote(marker)} w
  FileWrite $0 "Installation section reached"
  FileClose $0
SectionEnd
`
    );
    const compiled = spawnSync(compiler.path, ['/V2', script], {
      env: { ...process.env, ...compiler.env },
      encoding: 'utf8',
      timeout: 60000,
    });
    if (compiled.error) throw compiled.error;
    assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
    const result = spawnSync(executable, ['/S'], { timeout: 15000, windowsHide: true });
    if (result.error) throw result.error;
    assert.equal(result.status, expected, name + ': installer exit code');
    assert.equal(fs.existsSync(marker), expected === 0, name + ': installation section must be gated');
  }
  console.log(
    'PASS: compiled NSIS guard rejects unsupported Windows before installation and allows supported/native Windows'
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
