/* eslint no-console:0 */
const assert = require('assert').strict;
const { updaterFixture, ipcFixture, deferred } = require('./tests/updaterFixture.cjs');
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function run() {
  const f = updaterFixture();
  const ipc = ipcFixture(f.updates);
  assert.equal((await ipc.invoke('state')).state.available, false);
  for (const [command, value] of [
    ['quitAndInstall'],
    ['setFeedURL', 'https://example.invalid'],
    ['accept', { version: '0.55.0' }],
    ['decline', true],
    ['state', {}],
    ['prereleases', 'true'],
    ['check', null],
    ['check', []],
    ['check', { autoDownload: true }],
    ['check', { autoDownload: true, allowPrerelease: 'true' }],
    ['check', { autoDownload: true, allowPrerelease: false, url: 'https://example.invalid' }],
  ]) {
    assert.deepEqual(await ipc.invoke(command, value), { ok: false, error: 'invalid' });
  }
  assert.equal(f.calls.checks + f.calls.downloads + f.calls.stops, 0);
  f.release = { version: '0.55.0', files: [{ url: 'private-path' }], releaseNotes: 'not part of the IPC protocol' };
  await ipc.invoke('check', { autoDownload: false, allowPrerelease: false });
  const snapshot = (await ipc.invoke('state')).state;
  assert.equal(snapshot.version, '0.55.0');
  assert.equal(snapshot.available, true);
  assert(!JSON.stringify(snapshot).includes('private-path'));
  assert(!Object.hasOwn(snapshot, 'files') && !Object.hasOwn(snapshot, 'releaseNotes'));
  assert.equal(f.calls.downloads, 0);

  const download = ipc.invoke('accept');
  await ipc.invoke('accept');
  assert.equal(f.calls.downloads, 1, 'Duplicate consent must not start another download');
  f.library.emit('download-progress', { percent: 42.5 });
  assert.equal((await ipc.invoke('state')).state.percent, 42.5, 'Updater percentages are already on a 0-100 scale');
  for (const [percent, expected] of [
    [-1, 0],
    [101, 100],
    [NaN, null],
    ['50', null],
  ]) {
    f.library.emit('download-progress', { percent });
    assert.equal((await ipc.invoke('state')).state.percent, expected);
  }
  await ipc.invoke('decline');
  f.completeDownload();
  await download;
  assert.equal(f.calls.stops, 0, 'A background download must not restore declined install consent');
  assert.equal((await ipc.invoke('state')).state.declined, true, 'Reloads must recover the main-process choice');

  const canceled = ipc.invoke('accept');
  await ipc.invoke('accept');
  assert.equal(f.calls.stops, 1);
  assert.equal(f.calls.installs, 0);
  await ipc.invoke('decline');
  f.stop.resolve();
  await canceled;
  assert.equal(f.calls.installs, 0, 'Declining during shutdown must prevent installer launch');
  assert.equal((await ipc.invoke('state')).state.installationFailed, true);
  f.sdkStopped = false;
  const failed = ipc.invoke('accept');
  f.stop.reject(new Error('SDK did not exit cleanly'));
  await failed;
  assert.equal(f.calls.installs, 0);
  assert.equal(f.sdkStopped, false);
  assert.equal((await ipc.invoke('state')).state.failed, true);
  const retry = ipc.invoke('accept');
  assert.equal((await ipc.invoke('state')).state.failed, false);
  f.stop.resolve();
  await retry;
  assert.equal(f.calls.installs, 1);
  const revisions = ipc.messages.map(([channel, state]) => {
    assert.equal(channel, 'desktop-updater-state');
    return state.revision;
  });
  assert(revisions.every((value, index) => index === 0 || value > revisions[index - 1]));
  ipc.dispose();
  assert.equal(f.updates.listenerCount('state'), 0);

  const interruption = updaterFixture();
  const interruptedIpc = ipcFixture(interruption.updates);
  await interruptedIpc.invoke('check', { autoDownload: false, allowPrerelease: false });
  const interrupted = interruptedIpc.invoke('accept');
  interruption.failDownload();
  await interrupted;
  assert.equal((await interruptedIpc.invoke('state')).state.failed, true);
  assert.equal(interruption.calls.stops, 0);
  const retried = interruptedIpc.invoke('accept');
  await interruptedIpc.invoke('decline');
  interruption.completeDownload();
  await retried;
  assert.equal(interruption.calls.downloads, 2);
  assert.equal(interruption.calls.installs, 0);

  const checking = updaterFixture();
  const checkingIpc = ipcFixture(checking.updates);
  checking.checkGate = deferred();
  const pendingCheck = checkingIpc.invoke('check', { autoDownload: true, allowPrerelease: false });
  await checkingIpc.invoke('decline');
  checking.checkGate.resolve();
  await pendingCheck;
  assert.equal(checking.calls.downloads, 0, 'Late check results must respect a decline');

  const changed = updaterFixture();
  const changedIpc = ipcFixture(changed.updates);
  changed.library.emit('update-downloaded', changed.release);
  const changingInstall = changedIpc.invoke('accept');
  changed.library.emit('update-available', { version: '0.56.0' });
  changed.stop.resolve();
  await changingInstall;
  assert.equal(changed.calls.installs, 0, 'Consent for one version must not install another');

  const disabled = updaterFixture(false);
  const disabledIpc = ipcFixture(disabled.updates);
  disabled.library.emit('update-downloaded', disabled.release);
  await disabledIpc.invoke('check', { autoDownload: true, allowPrerelease: true });
  await disabledIpc.invoke('accept');
  assert.equal(disabled.calls.checks + disabled.calls.downloads + disabled.calls.stops, 0);

  for (const invalidate of [
    (fixture) => {
      fixture.current = null;
    },
    (fixture) => {
      fixture.window.isDestroyed = () => true;
    },
    (fixture) => {
      fixture.window.webContents.isDestroyed = () => true;
    },
    (fixture) => {
      fixture.event.sender = {};
    },
    (fixture) => {
      fixture.event.senderFrame = { url: fixture.event.senderFrame.url };
    },
    (fixture) => {
      fixture.event.senderFrame = null;
    },
    (fixture) => {
      fixture.event.senderFrame.url = 'https://example.invalid/';
    },
  ]) {
    const blocked = updaterFixture();
    const blockedIpc = ipcFixture(blocked.updates);
    invalidate(blockedIpc);
    for (const [command, value] of [
      ['state'],
      ['accept'],
      ['decline'],
      ['prereleases', true],
      ['check', { autoDownload: true, allowPrerelease: false }],
    ]) {
      assert.deepEqual(await blockedIpc.invoke(command, value), { ok: false, error: 'sender' });
    }
    assert.equal(blocked.calls.checks + blocked.calls.downloads + blocked.calls.stops, 0);
  }
  ipc.current = null;
  await tick();
  console.log(
    'PASS: updater IPC validation, progress, consent/decline races, download retry and clean SDK shutdown before installation'
  );
}

const timeout = setTimeout(() => {
  console.error('Updater IPC tests timed out');
  process.exit(1);
}, 10000);
run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => clearTimeout(timeout));
