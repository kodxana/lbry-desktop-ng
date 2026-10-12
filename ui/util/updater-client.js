import { ipcRenderer } from 'electron';

export async function requestUpdater(command, value) {
  try {
    return await ipcRenderer.invoke('desktop-updater', command, value);
  } catch (_) {
    return { ok: false, error: 'transport' };
  }
}
