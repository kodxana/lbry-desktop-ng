const { createRendererGuard } = require('./rendererGuard.cjs');

function registerWindowControls({ ipcMain, app, getWindow, rendererURL }) {
  const allowed = createRendererGuard(getWindow, rendererURL);
  ipcMain.on('window-control', (event, command) => {
    const window = getWindow();
    if (!allowed(event, window)) return;
    switch (command) {
      case 'focus':
        if (window.isMinimized()) window.restore();
        window.show();
        window.focus();
        break;
      case 'maximize':
        window.maximize();
        break;
      case 'leave-fullscreen':
        window.setFullScreen(false);
        break;
      case 'quit':
        // Use the normal application lifecycle so will-quit can wait for the SDK.
        app.quit();
        break;
    }
  });
}

function forwardFullscreenEvents(window) {
  const leave = () => {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send('window-left-fullscreen');
    }
  };
  window.on('leave-full-screen', leave);
  window.once('closed', () => window.removeListener('leave-full-screen', leave));
}

module.exports = { registerWindowControls, forwardFullscreenEvents };
