import { strict as assert } from 'assert';
import { ipcRenderer } from 'electron';
import Lbry from 'lbry';
import * as ACTIONS from 'constants/action_types';
import { doUpdateLoadStatus } from 'redux/actions/content';
import { listenForDownloadNotifications } from 'util/download-notifications';
import { getDesktopInfo } from 'util/desktop-info';
import { waitFor, tick } from './helpers';

export default async function downloadNotifications(store) {
  const control = (command) => ipcRenderer.invoke('fixture-download-notifications', command);
  const state = () => ipcRenderer.invoke('download-notifications', 'state');
  await control('configure');
  assert.equal((await getDesktopInfo('metadata')).locale, 'pl-PL');
  const beforeListeners = ipcRenderer.listenerCount('download-notification-state');
  let stop = listenForDownloadNotifications(store);
  const notifications = [];
  const OriginalNotification = window.Notification;
  const originalTimeout = window.setTimeout;
  const scheduled = [];
  window.Notification = class {
    constructor(title, options) {
      this.title = title;
      this.options = options;
      notifications.push(this);
    }
  };
  window.setTimeout = (callback, delay, ...args) => {
    if (delay === 1000) {
      scheduled.push(callback);
      return 0;
    }
    return originalTimeout(callback, delay, ...args);
  };
  let number = 0;
  let requests = 0;
  const complete = async (enabled, fileInfo = {}) => {
    store.dispatch({ type: ACTIONS.CLIENT_SETTING_CHANGED, data: { key: 'os_notifications_enabled', value: enabled } });
    const outpoint = 'fixture-download-' + ++number;
    const uri = 'lbry://fixture#' + number;
    const result = {
      outpoint,
      completed: true,
      written_bytes: 100,
      total_bytes: 100,
      metadata: { title: 'Test download' },
      ...fileInfo,
    };
    Lbry.file_list = async (params) => {
      requests++;
      assert.deepEqual(params, { outpoint, full_status: true, page: 1, page_size: 1 });
      return { items: [result] };
    };
    store.dispatch({ type: ACTIONS.DOWNLOADING_STARTED, data: { outpoint, fileInfo: result } });
    await store.dispatch(doUpdateLoadStatus(uri, outpoint));
    await state(); // Flush the completion IPC before inspecting its events.
    if (result.completed && result.written_bytes) {
      assert.equal(store.getState().fileInfo.downloadingByOutpoint[outpoint], undefined);
      assert.deepEqual(store.getState().fileInfo.byOutpoint[outpoint], result);
    }
    return outpoint;
  };
  try {
    await complete(true);
    await waitFor(() => store.getState().app.badgeNumber === 1, 'Background completion must update Redux');
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].title, 'LBRY Download Complete');
    assert.deepEqual(notifications[0].options, { body: 'Test download', silent: false });
    await complete(false);
    await waitFor(() => store.getState().app.badgeNumber === 2, 'Disabled popups still record a completed download');
    assert.equal(notifications.length, 1, 'Respect the OS notification preference');
    notifications[0].onclick();
    const clicked = await control();
    assert.deepEqual(clicked.windowCalls, ['restore', 'show', 'focus']);
    await waitFor(() => store.getState().app.badgeNumber === 0, 'Notification click must clear unread count');
    await complete(true, { metadata: undefined });
    assert.equal(notifications.length, 2, 'Missing metadata must not abort download completion');
    assert.equal((await state()).state.badgeNumber, 0, 'Foreground downloads have no unread badge');
    for (const fileInfo of [{ written_bytes: 0 }, { written_bytes: 50, completed: false }]) {
      const outpoint = await complete(true, fileInfo);
      assert(store.getState().fileInfo.downloadingByOutpoint[outpoint]);
      assert.equal(notifications.length, 2, 'Incomplete downloads must not notify');
      assert.equal((await state()).state.badgeNumber, 0);
      assert.equal(scheduled.length, 1);
      store.dispatch({ type: ACTIONS.FILE_DELETE, data: { outpoint } });
      const before = requests;
      scheduled.shift()();
      assert.equal(requests, before, 'Deleted downloads must stop polling');
    }

    // A delayed initial snapshot must not undo newer completion or focus events.
    stop();
    const invoke = ipcRenderer.invoke;
    let resolveSnapshot;
    const old = await state();
    try {
      ipcRenderer.invoke = (channel, ...args) =>
        channel === 'download-notifications' && args[0] === 'state'
          ? new Promise((resolve) => {
              resolveSnapshot = resolve;
            })
          : invoke.call(ipcRenderer, channel, ...args);
      stop = listenForDownloadNotifications(store);
    } finally {
      ipcRenderer.invoke = invoke;
    }
    await control('blur');
    await complete(true);
    await waitFor(() => store.getState().app.badgeNumber === 1, 'New completion event missing');
    resolveSnapshot(old);
    await tick();
    assert.equal(store.getState().app.badgeNumber, 1, 'Ignore an older initial snapshot');
    await control('focus');
    await waitFor(() => store.getState().app.badgeNumber === 0, 'Focus must reset the count');
    stop();
    assert.equal(ipcRenderer.listenerCount('download-notification-state'), beforeListeners);
    await control('blur');
    await complete(false);
    await tick();
    assert.equal(store.getState().app.badgeNumber, 0, 'Stopped listeners must not dispatch');
  } finally {
    stop();
    delete Lbry.file_list;
    window.Notification = OriginalNotification;
    window.setTimeout = originalTimeout;
  }
  return 'download completion, notification preferences and clicks, focus counts, polling and listener ordering';
}
