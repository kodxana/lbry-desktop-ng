function createDesktopBridge({ ipcRenderer, webFrame, webUtils, platform, electron, appImage, sandboxed }) {
  const subscribe = (channel, callback) => {
    if (typeof callback !== 'function') throw new TypeError('Expected a callback');
    const listener = (_event, ...values) => callback(...values);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  };
  return {
    platform,
    electron,
    appImage,
    sandboxed,
    info: (command) => ipcRenderer.invoke('desktop-info', command),
    cookieLocation: () => ipcRenderer.sendSync('cookie-location'),
    versions: () => ipcRenderer.invoke('desktop-versions'),
    password: (operation, value) => ipcRenderer.invoke('remembered-password', operation, value),
    updater: (command, value) => ipcRenderer.invoke('desktop-updater', command, value),
    onUpdater: (callback) => subscribe('desktop-updater-state', callback),
    backupWallet: (request) => ipcRenderer.invoke('wallet-backup', request),
    walletSetup: (operation, value) => ipcRenderer.invoke('wallet-setup', operation, value),
    walletCloudSyncEnabled: () => ipcRenderer.sendSync('wallet-cloud-sync-enabled'),
    cancelBackup: (id) => ipcRenderer.send('wallet-backup-cancel', id),
    openWalletFolder: () => ipcRenderer.invoke('wallet-folder'),
    selectFile: (request) => ipcRenderer.invoke('select-file', request),
    filePath: (file) => {
      const filePath = webUtils.getPathForFile(file);
      if (filePath) ipcRenderer.send('selected-file', filePath);
      return filePath;
    },
    fileUrl: (filePath) => ipcRenderer.sendSync('file-url', filePath),
    readDocument: (filePath) => ipcRenderer.invoke('read-document', filePath),
    fileDetails: (filePath) => ipcRenderer.invoke('get-file-details-from-path', filePath),
    savePost: (text) => ipcRenderer.invoke('save-post', text),
    openFile: (filePath) => ipcRenderer.invoke('open-content-file', filePath),
    revealFile: (filePath) => ipcRenderer.invoke('reveal-content-file', filePath),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    openLogs: () => ipcRenderer.invoke('open-profile-folder', 'logs'),
    openData: () => ipcRenderer.invoke('open-profile-folder', 'data'),
    autoLaunch: (command) => ipcRenderer.invoke('auto-launch', command),
    collectMessage: (message) => ipcRenderer.send('collect-message', message),
    contextMenu: (request) => ipcRenderer.invoke('context-menu', request),
    windowControl: (command) => ipcRenderer.send('window-control', command),
    onFullscreenExit: (callback) => subscribe('window-left-fullscreen', callback),
    downloads: (command) => ipcRenderer.invoke('download-notifications', command),
    onDownloads: (callback) => subscribe('download-notification-state', callback),
    requestDiskSpace: () => ipcRenderer.send('get-disk-space'),
    onDiskSpace: (callback) => subscribe('send-disk-space', callback),
    scanHubs: () => ipcRenderer.invoke('hub-servers-scan'),
    checkHub: (endpoint) => ipcRenderer.invoke('hub-servers-check', endpoint),
    selectHub: (endpoint) => ipcRenderer.invoke('hub-servers-select', endpoint),
    startupState: () => ipcRenderer.invoke('hub-startup-state'),
    prepareHubs: () => ipcRenderer.invoke('hub-servers-prepare'),
    hubConfig: () => ipcRenderer.invoke('hub-servers-config'),
    getZoom: () => webFrame.getZoomFactor(),
    setZoom: (factor) => {
      if (typeof factor !== 'number' || !Number.isFinite(factor) || factor < 0.25 || factor > 3) return;
      webFrame.setZoomFactor(factor);
    },
    onOpenUri: (callback) => subscribe('open-uri-requested', callback),
    onLanguage: (callback) => subscribe('language-set', callback),
    onMenu: (callback) => subscribe('open-menu', callback),
    onZoom: (callback) => subscribe('zoom-window', callback),
    onDevtools: (callback) => subscribe('devtools-is-opened', callback),
    onTargetUrl: (callback) => subscribe('update-target-url', callback),
  };
}

module.exports = { createDesktopBridge };
