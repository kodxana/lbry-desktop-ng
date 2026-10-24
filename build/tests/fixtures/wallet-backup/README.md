# Legacy wallet ZIP fixture

`adm-zip-0.4.16.zip` was generated with `generate.cjs` while adm-zip 0.4.16 was
installed, before the dependency upgrade. It uses `addLocalFolder`, the wallet
backup method used by desktop RC3. All contents are synthetic; there are no wallet
keys, credentials or funds. `manifest.json` records the archive hash, directory
names and exact file bytes.

The fixture includes nested files with matching basenames, an empty directory,
an empty file, a hidden file, binary bytes and a Unicode filename. The old writer
stored the Unicode filename as UTF-8 without setting the ZIP UTF-8 flag. Preserve
that behavior in this frozen fixture: the new reader must still recover it.
Do not regenerate this archive with the library under test. The generator checks
its dependency version and places temporary source files under `dist`.

`testWalletBackup.js` verifies both reading and extracting this legacy ZIP. New
backups from the production service are separately read with yauzl using standard
filename decoding, including their Unicode names and exact file bytes.
