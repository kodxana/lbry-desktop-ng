const { ipcMain } = require('electron');
const { registerWindowControls, forwardFullscreenEvents } = require('../../electron/windowControls.cjs');

module.exports = function configureWindowFixtures(getWindow, rendererURL) {
  const calls = [];
  registerWindowControls({ ipcMain, app: { quit: () => calls.push('quit') }, getWindow, rendererURL });
  ipcMain.handle('fixture-window-controls', (_event, operation) => {
    if (operation === 'leave-fullscreen') getWindow().emit('leave-full-screen');
    return calls;
  });
  return (window) => {
    // Exercise the real IPC transport while keeping the hidden test window stable.
    window.maximize = () => calls.push('maximize');
    window.setFullScreen = (value) => {
      calls.push(['fullscreen', value]);
      if (!value) window.emit('leave-full-screen');
    };
    forwardFullscreenEvents(window);
  };
};
