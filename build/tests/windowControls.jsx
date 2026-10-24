import { strict as assert } from 'assert';
import React from 'react';
import { ipcRenderer } from 'electron';
import Header from 'component/header/view';
import FileRender from 'component/fileRender/view';
import { doQuit, doQuitAnyDaemon } from 'redux/actions/app';
import { listenForFullscreenExit } from 'util/window-controls';
import { render, unmount, waitFor, tick } from './helpers';

export default async function windowControls(store, history) {
  const calls = () => ipcRenderer.invoke('fixture-window-controls');
  render(<Header authHeader history={history} />, store, history);
  document.querySelector('header').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  await waitFor(async () => (await calls()).includes('maximize'), 'Header double-click did not reach the main process');
  unmount();

  let exits = 0;
  let finishExit;
  const target = {
    fullscreenElement: {},
    exitFullscreen: () => {
      exits++;
      return new Promise((resolve) => {
        finishExit = resolve;
      });
    },
  };
  let stop = listenForFullscreenExit(target);
  // An unsupported render mode avoids loading media; the production Escape listener is still mounted.
  render(<FileRender renderMode="fixture" />, store, history);
  const escape = () =>
    window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 27, bubbles: true, cancelable: true }));
  escape();
  await waitFor(() => exits === 1, 'Escape did not propagate through native fullscreen exit and back to the document');
  assert.deepEqual((await calls())[1], ['fullscreen', false]);
  await ipcRenderer.invoke('fixture-window-controls', 'leave-fullscreen');
  await tick();
  assert.equal(exits, 1, 'Repeated native events must not overlap DOM exit requests');
  target.fullscreenElement = null;
  finishExit();
  await tick();
  await ipcRenderer.invoke('fixture-window-controls', 'leave-fullscreen');
  await tick();
  assert.equal(exits, 1, 'An idle document must not be asked to leave fullscreen');
  unmount();
  const before = (await calls()).length;
  escape();
  assert.equal((await calls()).length, before, 'Unmount must remove the player Escape listener');
  stop();

  const legacy = {
    webkitFullscreenElement: {},
    webkitExitFullscreen: () => {
      exits++;
    },
  };
  stop = listenForFullscreenExit(legacy);
  await ipcRenderer.invoke('fixture-window-controls', 'leave-fullscreen');
  await waitFor(() => exits === 2, 'Legacy fullscreen fallback did not run');
  stop();

  const failed = {
    fullscreenElement: {},
    exitFullscreen: async () => {
      exits++;
      throw new Error('Document already left fullscreen');
    },
  };
  stop = listenForFullscreenExit(failed);
  await ipcRenderer.invoke('fixture-window-controls', 'leave-fullscreen');
  await waitFor(() => exits === 3, 'Expected an attempted fullscreen exit');
  await tick();
  await ipcRenderer.invoke('fixture-window-controls', 'leave-fullscreen');
  await waitFor(() => exits === 4, 'A rejected DOM exit must remain retryable');
  stop();
  await ipcRenderer.invoke('fixture-window-controls', 'leave-fullscreen');
  await tick();
  assert.equal(exits, 4, 'Unsubscribing must remove the native fullscreen listener');

  store.dispatch(doQuit());
  store.dispatch(doQuitAnyDaemon());
  await waitFor(
    async () => (await calls()).filter((value) => value === 'quit').length === 2,
    'Quit actions must use the normal main-process application lifecycle'
  );
  return 'header maximize, player Escape/unmount, native/DOM fullscreen events and quit actions through real IPC';
}
