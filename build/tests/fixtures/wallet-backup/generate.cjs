// Run only with the old dependency installed; this fixture must not be rewritten
// by the library being tested during a migration.
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

assert.equal(require('adm-zip/package.json').version, '0.4.16');
const output = path.resolve(__dirname, '../../../../dist/legacy-backup-fixtures');
fs.mkdirSync(output, { recursive: true });
const source = fs.mkdtempSync(path.join(output, 'wallet-'));
const files = {
  'wallets/default_wallet': Buffer.from('{"fixture":"synthetic wallet; no keys or funds"}\n'),
  'wallets/żółć.json': Buffer.from('{"fixture":"Unicode filename and content: żółć"}\n'),
  'archive/default_wallet': Buffer.from('Another file with the same basename\n'),
  '.metadata': Buffer.from('Synthetic hidden file\n'),
  headers: Buffer.from([0, 255, 10, 13, 128, 65, 0]),
  'empty-file': Buffer.alloc(0),
};
fs.mkdirSync(path.join(source, 'empty'));
for (const [name, bytes] of Object.entries(files)) {
  const filename = path.join(source, name);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, bytes);
}
const zip = new AdmZip();
// RC3 used this method for wallet backup creation.
zip.addLocalFolder(source);
const bytes = zip.toBuffer();
fs.writeFileSync(path.join(__dirname, 'adm-zip-0.4.16.zip'), bytes);
fs.writeFileSync(
  path.join(__dirname, 'manifest.json'),
  JSON.stringify(
    {
      writer: 'adm-zip@0.4.16',
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      directories: ['archive/', 'empty/', 'wallets/'],
      files: Object.fromEntries(Object.entries(files).map(([name, contents]) => [name, contents.toString('base64')])),
    },
    null,
    2
  ) + '\n'
);
