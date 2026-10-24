/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const vm = require('vm');
const Zip = require('adm-zip');
const fetch = require('node-fetch').default;
const { stageBinary } = require('./sdkArtifact.cjs');

const output = path.resolve(__dirname, '../dist/artifact-download-tests');
fs.mkdirSync(output, { recursive: true });
const source = fs.readFileSync(path.join(__dirname, 'fetchSdkCandidate.js'), 'utf8');
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const name = process.platform === 'win32' ? 'lbrynet.exe' : 'lbrynet';
const binary = Buffer.from([0, 1, 127, 128, 254, 255]);
const zip = new Zip();
zip.addFile('artifact/' + name, binary);
const bytes = zip.toBuffer();

async function test(scenario) {
  const root = fs.mkdtempSync(path.join(output, scenario + '-'));
  const destination = path.join(root, 'static/daemon', name);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, 'previous SDK');
  const candidate = { repository: 'fixture/sdk', workflowRun: '1', headCommit: 'fixed-commit' };
  const artifact = {
    artifactId: '2',
    artifactName: 'sdk-fixture',
    archiveSha256: digest(bytes),
    sha256: digest(binary),
  };
  if (scenario === 'archive-hash') artifact.archiveSha256 = 'wrong';
  if (scenario === 'binary-hash') artifact.sha256 = 'wrong';
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push({ url: req.url, authorization: req.headers.authorization });
    if (req.url.includes('/actions/runs/')) {
      if (scenario === 'api-error') {
        res.writeHead(503);
        return res.end('Unavailable');
      }
      if (scenario === 'bad-json') return res.end('{broken');
      return res.end(
        JSON.stringify({
          head_sha: scenario === 'wrong-source' ? 'other' : candidate.headCommit,
          conclusion: 'success',
        })
      );
    }
    if (req.url.endsWith('/actions/artifacts/2')) {
      return res.end(
        JSON.stringify({ workflow_run: { id: 1 }, name: artifact.artifactName, expired: scenario === 'expired' })
      );
    }
    if (req.url.endsWith('/zip')) {
      res.writeHead(302, {
        Location: (scenario === 'insecure-url' ? 'http:' : 'https:') + '//archive.invalid/sdk.zip',
      });
      return res.end();
    }
    assert.equal(req.url, '/archive.invalid/sdk.zip');
    if (scenario === 'headers-timeout') return;
    if (scenario === 'body-timeout') {
      res.writeHead(200);
      res.write(bytes.subarray(0, 2));
      return;
    }
    if (scenario === 'truncated') {
      res.writeHead(200, { 'Content-Length': bytes.length });
      res.write(bytes.subarray(0, 2));
      return setImmediate(() => res.destroy());
    }
    res.end(bytes);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const localFetch = (url, options) => {
    const target = new URL(url);
    const forwarded = { ...options };
    if (target.hostname === 'archive.invalid') {
      assert.equal(options.size, 512 * 1024 * 1024, 'Retain the SDK archive limit');
      assert(options.signal instanceof AbortSignal, 'Downloads must use a real abort deadline');
      if (scenario === 'oversized') forwarded.size = 2;
      // Shorten the production deadline, retaining the real transport's timeout mechanism.
      forwarded.signal = AbortSignal.timeout(scenario.endsWith('-timeout') ? 50 : 1000);
    }
    return fetch('http://127.0.0.1:' + server.address().port + '/' + target.hostname + target.pathname, forwarded);
  };
  const module = { exports: {} };
  const dependencies = {
    'node-fetch': { default: localFetch },
    './sdk-candidate.json': candidate,
    './sdkArtifact.cjs': { artifactFor: () => artifact, stageBinary },
  };
  vm.runInNewContext(source, {
    require: (name) => (Object.prototype.hasOwnProperty.call(dependencies, name) ? dependencies[name] : require(name)),
    module,
    __dirname: path.join(root, 'build'),
    Buffer,
    URL,
    AbortSignal,
    process: { platform: process.platform, env: { GITHUB_TOKEN: 'synthetic-test-token' } },
    console: { log: () => {} },
  });
  try {
    if (scenario === 'success') {
      await module.exports();
      assert.deepEqual(fs.readFileSync(destination), binary, 'Binary bytes must remain unchanged');
    } else {
      await assert.rejects(
        module.exports(),
        {
          'archive-hash': /archive SHA-256 mismatch/,
          'binary-hash': /SDK SHA-256 mismatch/,
          'api-error': /GitHub API 503/,
          'bad-json': /JSON/,
          'wrong-source': /source changed/,
          expired: /expired/,
          'insecure-url': /https/,
          oversized: /max-size|over limit/,
          'headers-timeout': /abort|timeout/i,
          'body-timeout': /abort|timeout/i,
          truncated: /Premature|aborted|closed|timeout/i,
        }[scenario]
      );
      assert.equal(
        fs.readFileSync(destination, 'utf8'),
        'previous SDK',
        'A failed download must preserve the installed SDK'
      );
    }
    for (const request of requests) {
      assert.equal(
        request.authorization,
        request.url.startsWith('/api.github.com/') ? 'Bearer synthetic-test-token' : undefined
      );
    }
    assert(!fs.readdirSync(path.dirname(destination)).some((file) => file.includes('.partial')));
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

(async () => {
  for (const scenario of [
    'success',
    'api-error',
    'bad-json',
    'wrong-source',
    'expired',
    'insecure-url',
    'archive-hash',
    'binary-hash',
    'oversized',
    'headers-timeout',
    'body-timeout',
    'truncated',
  ]) {
    await test(scenario);
  }
  console.log('PASS: SDK download bytes, credentials, limits/timeouts, source/hash checks and failure preservation');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
