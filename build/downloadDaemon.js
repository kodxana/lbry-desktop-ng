/* eslint no-console:0 */
const path = require('path');
const fs = require('fs');
const { artifactFor, verifiedBytes, stageBinary } = require('./sdkArtifact.cjs');
const { lbrySettings } = require('../package.json');
const candidate = require('./sdk-candidate.json');

// PR candidates are supplied from CI, never from the older public rc4 release.
function prepareDaemon(source = process.env.LBRY_SDK_BINARY) {
  if (lbrySettings.lbrynetDaemonVersion !== candidate.version) throw new Error('SDK version pin mismatch.');
  const platform = { windows: 'win32', mac: 'darwin', macos: 'darwin' }[process.env.TARGET] ||
    process.env.TARGET || process.platform;
  const artifact = artifactFor(platform);
  const directory = path.resolve(__dirname, '..', lbrySettings.lbrynetDaemonDir);
  const destination = path.join(directory, 'lbrynet' + (platform === 'win32' ? '.exe' : ''));
  fs.mkdirSync(directory, { recursive: true });
  if (source) {
    stageBinary(path.resolve(source), destination, artifact.sha256);
  } else {
    try {
      verifiedBytes(destination, artifact.sha256);
    } catch (_) {
      throw new Error('Supply LBRY_SDK_BINARY or a file argument from the release-candidate artifact at ' +
        'https://github.com/' + candidate.repository + '/actions/runs/' + candidate.workflowRun);
    }
  }
  console.log('Verified SDK ' + candidate.version + ' (' + candidate.headCommit.slice(0, 8) + '): ' + destination);
}

if (require.main === module) {
  try { prepareDaemon(process.argv[2]) } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = prepareDaemon;
