/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch').default;
const Zip = require('adm-zip');
const candidate = require('./sdk-candidate.json');
const { artifactFor, stageBinary } = require('./sdkArtifact.cjs');

async function main() {
  const artifact = { ...candidate, ...artifactFor() };
  const base = 'https://api.github.com/repos/' + candidate.repository;
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'lbry-desktop-ci' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
  async function api(suffix) {
    const response = await fetch(base + suffix, { headers, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('GitHub API ' + response.status + ': ' + suffix);
    return response.json();
  }
  const run = await api('/actions/runs/' + candidate.workflowRun);
  assert.equal(run.head_sha, candidate.headCommit, 'SDK workflow source changed');
  assert.equal(run.conclusion, 'success', 'Pinned SDK workflow must have passed');
  const metadata = await api('/actions/artifacts/' + artifact.artifactId);
  assert.equal(String(metadata.workflow_run.id), candidate.workflowRun);
  assert.equal(metadata.name, artifact.artifactName);
  assert.equal(metadata.expired, false, 'SDK artifact expired; supply the exact pinned binary or review a new pin');
  const redirect = await fetch(base + '/actions/artifacts/' + artifact.artifactId + '/zip', {
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(redirect.status, 302, 'GitHub did not provide the SDK archive');
  const location = new URL(redirect.headers.get('location'));
  assert.equal(location.protocol, 'https:');
  // The signed archive URL needs no GitHub credentials.
  const response = await fetch(location.href, { signal: AbortSignal.timeout(120000), size: 512 * 1024 * 1024 });
  assert(response.ok, 'SDK archive download failed: ' + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(
    crypto.createHash('sha256').update(bytes).digest('hex'),
    artifact.archiveSha256,
    'SDK archive SHA-256 mismatch'
  );
  const name = 'lbrynet' + (process.platform === 'win32' ? '.exe' : '');
  const zip = new Zip(bytes);
  const entries = zip.getEntries().filter((entry) => !entry.isDirectory && entry.entryName.split('/').pop() === name);
  assert.equal(entries.length, 1, 'SDK archive must contain exactly one platform executable');
  const directory = path.resolve(__dirname, '../dist/sdk-candidate');
  fs.mkdirSync(directory, { recursive: true });
  const source = path.join(directory, name);
  fs.writeFileSync(source, entries[0].getData(), { mode: 0o755 });
  const destination = path.resolve(__dirname, '../static/daemon', name);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  stageBinary(source, destination, artifact.sha256);
  console.log('Verified SDK ' + candidate.headCommit + ' for ' + process.platform);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
module.exports = main;
