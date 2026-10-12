import { ipcRenderer } from 'electron';
import * as ACTIONS from 'constants/action_types';

export function recordDownloadComplete() {
  return ipcRenderer.invoke('download-notifications', 'completed').catch(() => null);
}

export function listenForDownloadNotifications(store) {
  let disposed = false;
  let revision = -1;
  const receive = (_event, state) => {
    if (disposed || !state || state.revision <= revision) return;
    revision = state.revision;
    store.dispatch({ type: ACTIONS.DOWNLOAD_NOTIFICATION_STATE, data: state });
  };
  ipcRenderer.on('download-notification-state', receive);
  ipcRenderer
    .invoke('download-notifications', 'state')
    .then((result) => {
      if (result && result.ok) receive(null, result.state);
    })
    .catch(() => {});
  return () => {
    disposed = true;
    ipcRenderer.removeListener('download-notification-state', receive);
  };
}
