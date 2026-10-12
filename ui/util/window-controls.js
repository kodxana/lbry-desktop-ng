import { ipcRenderer } from 'electron';

export const maximizeWindow = () => ipcRenderer.send('window-control', 'maximize');
export const leaveWindowFullscreen = () => ipcRenderer.send('window-control', 'leave-fullscreen');
export const quitApplication = () => ipcRenderer.send('window-control', 'quit');

// Native fullscreen can end through Escape or the application menu. Keep the
// HTML fullscreen state in sync without exposing a BrowserWindow to the renderer.
export function listenForFullscreenExit(target = document) {
  let exiting = false;
  const leave = async () => {
    if (exiting) return;
    exiting = true;
    try {
      if (target.fullscreenElement && target.exitFullscreen) {
        await target.exitFullscreen();
      } else if (target.webkitFullscreenElement && target.webkitExitFullscreen) {
        await target.webkitExitFullscreen();
      }
    } catch (_) {
      // The document may have left fullscreen or been detached in the meantime.
    } finally {
      exiting = false;
    }
  };
  ipcRenderer.on('window-left-fullscreen', leave);
  return () => ipcRenderer.removeListener('window-left-fullscreen', leave);
}
