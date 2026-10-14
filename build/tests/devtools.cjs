/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { app, net, session } = require('electron');

const output = path.resolve(__dirname, '../../dist/devtools-tests');
fs.mkdirSync(output, { recursive: true });
const root = fs.mkdtempSync(path.join(output, 'profile-'));
app.setPath('userData', root);
app.disableHardwareAcceleration();
const timeout = setTimeout(() => app.exit(1), 30000);

app
  .whenReady()
  .then(async () => {
    let requests = 0;
    // Only synthetic cached extensions may be loaded into this disposable profile.
    net.request = () => {
      requests++;
      throw new Error('Unexpected extension download');
    };
    const installer = require('electron-devtools-installer');
    const fixtures = [
      [installer.REACT_DEVELOPER_TOOLS, 'Fixture React tools'],
      [installer.REDUX_DEVTOOLS, 'Fixture Redux tools'],
    ];
    for (const [reference, name] of fixtures) {
      const directory = path.join(root, 'extensions', reference.id);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(
        path.join(directory, 'manifest.json'),
        JSON.stringify({
          manifest_version: 3,
          version: '1.0',
          name,
          devtools_page: 'devtools.html',
        })
      );
      fs.writeFileSync(
        path.join(directory, 'devtools.html'),
        '<!doctype html><title>Synthetic devtools fixture</title>'
      );
    }
    if (process.argv.includes('--failure')) {
      fs.writeFileSync(path.join(root, 'extensions', fixtures[0][0].id, 'manifest.json'), '{broken');
    }
    const filename = path.resolve(__dirname, '../../electron/installDevtools.js');
    const source = require('@babel/core').transformFileSync(filename, {
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    }).code;
    const logs = [];
    const module = { exports: {} };
    vm.runInNewContext(source, {
      require,
      module,
      exports: module.exports,
      console: { log: (...args) => logs.push(args) },
    });
    await module.exports.default();
    const installed = session.defaultSession.getAllExtensions();
    const expected = process.argv.includes('--failure') ? [fixtures[1]] : fixtures;
    assert.deepEqual(installed.map((extension) => extension.name).sort(), expected.map(([, name]) => name).sort());
    for (const [, name] of expected) {
      assert(
        logs.some(([message]) => message === 'Added Extension:  ' + name),
        'Log the installed extension name'
      );
    }
    assert.equal(
      logs.filter(([message]) => message === 'An error occurred: ').length,
      fixtures.length - expected.length
    );
    const existing = installed.find((extension) => extension.name === 'Fixture Redux tools');
    assert.equal((await installer.installExtension(existing.id)).id, existing.id, 'Reuse an installed extension');
    assert.equal(session.defaultSession.getAllExtensions().length, expected.length);
    assert.equal(requests, 0, 'Cached and already-installed extensions must not download');
    console.log(
      'PASS: devtools ' +
        (process.argv.includes('--failure')
          ? 'failure leaves the next extension usable'
          : 'cached loading, names and reuse')
    );
    clearTimeout(timeout);
    app.exit(0);
  })
  .catch((error) => {
    console.error(error);
    clearTimeout(timeout);
    app.exit(1);
  });
