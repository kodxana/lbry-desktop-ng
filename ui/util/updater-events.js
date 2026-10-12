import { ipcRenderer } from 'electron';
import * as ACTIONS from 'constants/action_types';
import { doAutoUpdate, doAutoUpdateFail } from 'redux/actions/app';
import { requestUpdater } from './updater-client';

export function listenForUpdater(store) {
  let disposed = false;
  let revision = -1;
  let promptedVersion;
  const receive = (_event, state) => {
    if (disposed || state.revision <= revision) return;
    revision = state.revision;
    store.dispatch({ type: ACTIONS.DESKTOP_UPDATE_STATE, data: state });
    if (
      state.enabled &&
      state.available &&
      state.state === 'downloaded' &&
      !state.accepted &&
      !state.declined &&
      !state.installing &&
      !state.failed &&
      state.version !== promptedVersion
    ) {
      promptedVersion = state.version;
      store.dispatch(doAutoUpdate());
    }
  };
  // Listen before requesting the snapshot; a newer event must win over a late reply.
  ipcRenderer.on('desktop-updater-state', receive);
  requestUpdater('state').then((result) => {
    if (disposed) return;
    if (result.ok) receive(null, result.state);
    else if (revision < 0) store.dispatch(doAutoUpdateFail());
  });
  return () => {
    disposed = true;
    ipcRenderer.removeListener('desktop-updater-state', receive);
  };
}
