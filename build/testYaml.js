/* eslint no-console:0 */
const assert = require('assert').strict;
const yaml = require('js-yaml');
const { parseHubConfig } = require('../electron/hubServers.cjs');

for (const source of ['', ' \n# comment only\n', '\uFEFF# comment\n', '{}', 'null', '---\n']) {
  assert.equal(parseHubConfig(source), null, 'Empty configuration should use automatic hubs');
}
assert.deepEqual(parseHubConfig('lbryum_servers: []'), []);
assert.deepEqual(parseHubConfig('lbryum_servers: ["s1.lbry.network:50001", [hub.lbry.grin.io, 50001]]'), [
  ['s1.lbry.network', 50001],
  ['hub.lbry.grin.io', 50001],
]);
const inherited = 'defaults: &hubs\n  lbryum_servers: ["s1.lbry.network:50001"]\n<<: *hubs\n';
assert.deepEqual(parseHubConfig(inherited), [['s1.lbry.network', 50001]], 'Keep existing YAML merge configurations');
assert.deepEqual(
  parseHubConfig(inherited + 'lbryum_servers: ["hub.lbry.grin.io:50001"]\n'),
  [['hub.lbry.grin.io', 50001]],
  'Explicit hub lists override merged defaults'
);
for (const source of [
  'lbryum_servers: [',
  'lbryum_servers: ["hub:0"]',
  'lbryum_servers: ["hub:65536"]',
  'lbryum_servers: null',
  'lbryum_servers: "hub:50001"',
  'lbryum_servers: []\nlbryum_servers: []',
  '---\nlbryum_servers: []\n---\n{}',
  'lbryum_servers: !unknown []',
]) {
  assert.throws(() => parseHubConfig(source), 'Invalid configuration must not silently select defaults');
}

const settings = {
  lbryum_servers: ['s1.lbry.network:50001'],
  save_files: false,
  share_usage_data: false,
  blob_storage_limit: 0,
  download_directory: 'F:\\Media ł #1',
  wallet_dir: '/tmp/wallet ł',
};
assert.deepEqual(yaml.load(yaml.dump(settings)), settings, 'Preserve SDK setting types and paths');
assert.deepEqual(parseHubConfig(yaml.dump(settings)), [['s1.lbry.network', 50001]]);
const release = {
  version: '0.54.0-rc.4',
  files: [{ url: 'LBRY-Desktop-NG.exe', sha512: Buffer.alloc(64, 255).toString('base64'), size: 123456789 }],
  releaseDate: '2026-10-14T12:34:56.000Z',
  releaseNotes: 'First line\n\nNotes with # and : characters\n',
};
assert.deepEqual(yaml.load(yaml.dump(release)), release);
// Keep the updater's independently resolved parser in the compatibility check.
const updaterYaml = require(require.resolve('js-yaml', { paths: [require.resolve('electron-updater')] }));
assert.deepEqual(updaterYaml.load(yaml.dump(release)), release, 'Installed updaters must read newly emitted YAML');
console.log('PASS: empty/merged/invalid hub YAML, settings types/paths and updater metadata compatibility');
