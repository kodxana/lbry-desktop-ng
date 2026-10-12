import { ipcRenderer } from 'electron';

export async function getDesktopInfo(command) {
  const result = await ipcRenderer.invoke('desktop-info', command);
  if (!result || !result.ok) throw new Error('Desktop information unavailable');
  return result;
}
