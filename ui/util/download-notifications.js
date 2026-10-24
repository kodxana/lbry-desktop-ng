import desktop from 'util/desktop';
import * as ACTIONS from 'constants/action_types';

export function recordDownloadComplete() {
  return desktop.downloads('completed').catch(() => null);
}

export function listenForDownloadNotifications(store) {
  let disposed = false;
  let revision = -1;
  const receive = (state) => {
    if (disposed || !state || state.revision <= revision) return;
    revision = state.revision;
    store.dispatch({ type: ACTIONS.DOWNLOAD_NOTIFICATION_STATE, data: state });
  };
  const unsubscribe = desktop.onDownloads(receive);
  desktop.downloads('state')
    .then((result) => {
      if (result && result.ok) receive(result.state);
    })
    .catch(() => {});
  return () => {
    disposed = true;
    unsubscribe();
  };
}
