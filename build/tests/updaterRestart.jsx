import { strict as assert } from 'assert';
import { ipcRenderer } from 'electron';
import { listenForUpdater } from 'util/updater-events';
import { waitFor } from './helpers';

export default async function updaterRestart(store) {
  assert.equal(
    store.getState().app.autoUpdateDeclined,
    false,
    'Update choices must not come from persisted Redux data'
  );
  const stop = listenForUpdater(store);
  try {
    await waitFor(
      () => store.getState().app.autoUpdateDeclined,
      'Renderer restart did not recover the main-process choice'
    );
    assert.equal(store.getState().app.autoUpdateDownloaded, true);
    assert.equal(store.getState().app.modal, null, 'A restarted renderer must not prompt for a declined update');
    assert.equal((await ipcRenderer.invoke('fixture-updater')).calls.installs, 0);
  } finally {
    stop();
  }
  return 'renderer restart restores downloaded status and declined choice without prompting or installing';
}
