/* eslint no-console:0 */
const assert = require('assert').strict;
const { pathToFileURL } = require('url');
const { app } = require('electron');

module.exports = async () => {
  const original = { ELECTRON_IS_DEV: process.env.ELECTRON_IS_DEV, NODE_ENV: process.env.NODE_ENV };
  const entry = pathToFileURL(require.resolve('electron-is-dev'));
  assert.equal(app.isPackaged, false, 'This fixture must run in the development Electron executable');
  try {
    let index = 0;
    for (const mode of ['production', 'development']) {
      process.env.NODE_ENV = mode;
      for (const [override, expected] of [
        [undefined, true],
        ['1', true],
        ['0', false],
        ['', false],
        ['true', false],
      ]) {
        if (override === undefined) delete process.env.ELECTRON_IS_DEV;
        else process.env.ELECTRON_IS_DEV = override;
        // Each URL evaluates the real ESM module with fresh environment settings.
        const result = await import(entry.href + '?case=' + index++);
        assert.equal(result.default, expected, 'Incorrect mode for ' + mode + ' / ' + override);
      }
    }
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  console.log(
    'PASS: Electron development detection, ESM default export, explicit overrides and independence from NODE_ENV'
  );
};
