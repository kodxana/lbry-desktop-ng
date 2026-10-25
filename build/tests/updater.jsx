import { strict as assert } from 'assert';
import React from 'react';
import { connect } from 'react-redux';
import { ipcRenderer } from 'electron';
import AutoUpdateModal from 'modal/modalAutoUpdateDownloaded';
import * as MODALS from 'constants/modal_types';
import { doOpenModal, doHideModal } from 'redux/actions/app';
import { requestUpdater } from 'util/updater-client';
import { listenForUpdater } from 'util/updater-events';
import { render, unmount, waitFor, tick } from './helpers';

const UpdateScreen = connect((state) => ({ modal: state.app.modal }))(
  // eslint-disable-next-line react/prop-types
  ({ modal }) => (modal === MODALS.AUTO_UPDATE_DOWNLOADED ? <AutoUpdateModal /> : null)
);
const fixture = (operation, value) => ipcRenderer.invoke('fixture-updater', operation, value);
const button = (label) => Array.from(document.querySelectorAll('button')).find((node) => node.textContent === label);

export default async function updater(store, history) {
  const originalFetch = window.fetch;
  window.fetch = async (url) => {
    assert(String(url).startsWith('https://api.github.com/repos/kodxana/lbry-desktop-ng/releases'));
    return { ok: true, json: async () => ({ tag_name: 'v0.55.0', body: 'Synthetic release notes' }) };
  };
  let stop = () => {};
  const open = async () => {
    store.dispatch(doOpenModal(MODALS.AUTO_UPDATE_DOWNLOADED));
    await waitFor(() => button('Upgrade Now'), 'The update prompt must render before accepting');
  };
  const reset = async () => {
    stop();
    store.dispatch(doHideModal());
    await fixture('reset');
    stop = listenForUpdater(store);
    await requestUpdater('check', { autoDownload: false, allowPrerelease: false });
    await waitFor(
      () => store.getState().app.isUpgradeAvailable && !store.getState().app.autoUpdateDeclined,
      'Update availability was not received'
    );
  };
  try {
    render(<UpdateScreen />, store, history);
    await reset();
    assert.equal(store.getState().app.remoteVersion, '0.55.0');
    await open();
    const confirm = button('Upgrade Now');
    confirm.click();
    confirm.click();
    await waitFor(() => !!button('Downloading...'), 'Accept did not start downloading');
    assert(button('Downloading...').disabled);
    assert.equal((await fixture()).calls.downloads, 1);
    await fixture('progress', 42.5);
    await waitFor(() => store.getState().app.downloadProgress === 42.5, 'Incorrect updater progress scale');
    await fixture('fail-decline');
    button('Keep browsing').click();
    await waitFor(
      () => document.body.textContent.includes('There was an error while updating'),
      'A failed decline must be shown'
    );
    assert.equal(
      store.getState().app.modal,
      MODALS.AUTO_UPDATE_DOWNLOADED,
      'Do not close until the main process acknowledges decline'
    );
    assert.equal((await fixture()).state.accepted, true);
    assert.equal(store.getState().app.autoUpdateDownloading, true);
    await fixture('allow-decline');
    button('Keep browsing').click();
    await waitFor(() => !store.getState().app.modal, 'Successful decline must close the prompt');
    await fixture('complete');
    await waitFor(() => store.getState().app.autoUpdateDownloaded, 'Background download did not finish');
    assert.equal(store.getState().app.autoUpdateDeclined, true);
    assert.equal(store.getState().app.modal, null, 'A declined background download must not reopen the prompt');
    assert.equal((await fixture()).calls.stops, 0);

    await open();
    button('Upgrade Now').click();
    await waitFor(() => !!button('Installing...'), 'Manual acceptance of a cached update did not start SDK shutdown');
    assert(button('Installing...').disabled);
    assert(button('Not Now').disabled);
    assert.equal((await fixture()).calls.installs, 0);
    await fixture('fail-stop');
    await waitFor(
      () => !!button('Upgrade Now') && !button('Upgrade Now').disabled,
      'Shutdown failure must allow an explicit retry'
    );
    assert(document.body.textContent.includes('There was an error while updating'));
    assert.equal((await fixture()).calls.installs, 0);
    button('Upgrade Now').click();
    await waitFor(async () => (await fixture()).calls.stops === 2, 'Retry did not request shutdown');
    await fixture('finish-stop');
    await waitFor(
      async () => (await fixture()).calls.installs === 1,
      'Installer handoff did not wait for clean shutdown'
    );

    await reset();
    await open();
    button('Upgrade Now').click();
    await waitFor(async () => (await fixture()).calls.downloads === 1, 'Download did not start');
    await fixture('fail-download');
    await waitFor(
      () => store.getState().app.autoUpdateFailed && button('Upgrade Now')?.disabled === false,
      'Download failure must allow retry'
    );
    button('Upgrade Now').click();
    await waitFor(async () => (await fixture()).calls.downloads === 2, 'Retry did not start another download');
    await waitFor(() => !!button('Keep browsing'), 'Retry did not update the download prompt');
    button('Keep browsing').click();
    await waitFor(() => !store.getState().app.modal, 'Keep browsing did not decline the retry');
    await fixture('complete');
    await waitFor(() => store.getState().app.autoUpdateDownloaded, 'Retried download did not finish');
    assert.equal((await fixture()).calls.installs, 0);

    stop();
    await fixture('reset');
    await fixture('hold-snapshot');
    stop = listenForUpdater(store);
    await waitFor(async () => (await fixture()).pendingSnapshot, 'Snapshot was not held');
    await fixture('available');
    await waitFor(
      () => store.getState().app.isUpgradeAvailable && store.getState().app.downloadProgress === null,
      'Newer update event was not received'
    );
    await fixture('release-snapshot');
    await waitFor(async () => !(await fixture()).pendingSnapshot, 'Old snapshot was not released');
    await tick();
    assert.equal(
      store.getState().app.isUpgradeAvailable,
      true,
      'A late initial snapshot must not overwrite a newer event'
    );

    stop();
    await fixture('hold-snapshot');
    stop = listenForUpdater(store);
    await waitFor(async () => (await fixture()).pendingSnapshot, 'Second snapshot was not held');
    stop();
    const detached = store.getState().app;
    await fixture('progress', 10);
    await fixture('release-snapshot');
    await waitFor(async () => !(await fixture()).pendingSnapshot, 'Detached snapshot was not released');
    await tick();
    assert.equal(store.getState().app, detached, 'Disposed listeners must ignore events and pending replies');

    // Leave a declined, fully downloaded update in main-process memory for the next renderer.
    await reset();
    const background = requestUpdater('check', { autoDownload: true, allowPrerelease: false });
    await waitFor(async () => (await fixture()).calls.downloads === 1, 'Automatic download did not begin');
    await fixture('complete');
    await background;
    await waitFor(() => !!button('Not Now'), 'An unaccepted background update should offer an install choice');
    button('Not Now').click();
    await waitFor(
      () => !store.getState().app.modal && store.getState().app.autoUpdateDeclined,
      'Not Now must be acknowledged'
    );
    assert.equal((await fixture()).calls.installs, 0);
  } finally {
    stop();
    unmount();
    window.fetch = originalFetch;
  }
  return 'real updater IPC/Redux/modal consent, declined background downloads, failures/retry, SDK shutdown gating, snapshot ordering and cleanup';
}
