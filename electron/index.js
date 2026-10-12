/* eslint no-console:0 */
/* eslint space-before-function-paren:0 */
// Module imports
import '@babel/polyfill';
import { app, dialog, ipcMain, session, safeStorage, Menu, clipboard } from 'electron';
import { autoUpdater } from 'electron-updater';
import Lbry from 'lbry';
import LbryFirstInstance from './LbryFirstInstance';
import isDev from 'electron-is-dev';
import createTray from './createTray';
import createWindow, { rendererURL } from './createWindow';
import { DOMAIN } from 'config';
import pjson from '../package.json';
import startSandbox from './startSandbox';
import installDevtools from './installDevtools';
import fs from 'fs';
import path from 'path';
import desktopSettings from '../desktop-settings.json';

const Daemon = require('./Daemon.cjs');
const { createProfile } = require('./testProfile.cjs');
const DesktopUpdater = require('./DesktopUpdater.cjs');
const { registerUpdaterIpc } = require('./updaterIpc.cjs');
const { registerPasswordStorage } = require('./passwordStorage.cjs');
const { registerFileSelection } = require('./fileSelection.cjs');
const { registerWindowControls } = require('./windowControls.cjs');
const { registerContextMenu } = require('./contextMenu.cjs');
const { registerDesktopInfo } = require('./desktopInfo.cjs');
const { registerDownloadNotifications } = require('./downloadNotifications.cjs');
const { getDiskSpace } = require('./diskSpace.cjs');
const { HubSelection, parseServer } = require('./hubServers.cjs');
const yaml = require('js-yaml');
const mime = require('mime');
const probe = require('ffmpeg-probe');
const MAX_IPC_SEND_BUFFER_SIZE = 500000000; // large files crash when serialized for ipc message

const rootFlag = desktopSettings.autoUpdates ? '--ng-profile=' : '--sdk-test-root=';
const rootArgument = process.argv.find(arg => arg.startsWith(rootFlag));
const desktopProfile = createProfile(rootArgument
  ? rootArgument.slice(rootFlag.length)
  : path.join(app.getPath('appData'), desktopSettings.appName), desktopSettings);
app.setPath('userData', desktopProfile.desktop);
// Chromium session data defaults to this profile's userData directory.
app.setPath('logs', desktopProfile.logs);
app.setPath('downloads', desktopProfile.downloads);
app.setPath('temp', desktopProfile.temp);

// Keep a global reference, if you don't, they will be closed automatically when the JavaScript
// object is garbage collected.
let rendererWindow;
registerDesktopInfo({ ipcMain, app, getWindow: () => rendererWindow, rendererURL });
const attachDownloadNotifications = registerDownloadNotifications({
  ipcMain, app, getWindow: () => rendererWindow, rendererURL,
});
registerFileSelection({ ipcMain, app, dialog, getWindow: () => rendererWindow, rendererURL });
registerWindowControls({ ipcMain, app, getWindow: () => rendererWindow, rendererURL });
registerContextMenu({ ipcMain, Menu, clipboard, getWindow: () => rendererWindow, rendererURL, isDev });
registerPasswordStorage({
  ipcMain,
  safeStorage,
  directory: desktopProfile.desktop,
  getWindow: () => rendererWindow,
  rendererURL,
  cookies: {
    get: (...args) => session.defaultSession.cookies.get(...args),
    remove: (...args) => session.defaultSession.cookies.remove(...args),
    flushStore: () => session.defaultSession.cookies.flushStore(),
  },
  dialog,
  domains: [DOMAIN],
});

let tray; // eslint-disable-line
let daemon;
let lbryFirst;

const appState = {};
const PROTOCOL = 'lbry';

// Keep the community and test profiles separate from the original desktop app.
app.name = desktopSettings.appName;
app.setAppUserModelId(desktopSettings.appId);
app.commandLine.appendSwitch('force-color-profile', 'srgb');
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');

if (isDev) {
  // Disable security warnings in dev mode:
  // https://github.com/electron/electron/blob/master/docs/tutorial/security.md#electron-security-warnings
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true;
}

const startDaemon = async (settingsOnly = false) => {
  const directory = isDev ? path.join(__static, 'daemon') : path.join(process.resourcesPath, 'static', 'daemon');
  const binary = process.env.LBRY_DAEMON || path.join(directory, 'lbrynet' + (process.platform === 'win32' ? '.exe' : ''));
  daemon = new Daemon(desktopProfile, binary, process.env.LBRY_HEADERS);
  await daemon.launch({ settingsOnly });
  const ownedDaemon = daemon;
  ownedDaemon.on('exit', () => {
    if (daemon === ownedDaemon) daemon = null;
    if (!appState.isQuitting && !ownedDaemon.expectedExit) {
      dialog.showErrorBox('SDK exited', 'See the logs in ' + desktopProfile.logs);
      app.quit();
    }
  });
};

const hubSetupMarker = path.join(desktopProfile.root, 'hub-setup-complete.json');
const readHubConfig = () => {
  const config = yaml.load(fs.readFileSync(desktopProfile.config, 'utf8')) || {};
  return Object.prototype.hasOwnProperty.call(config, 'lbryum_servers')
    ? config.lbryum_servers.map(endpoint => { const { host, port } = parseServer(endpoint); return [host, port] }) : null;
};
const hubs = new HubSelection({
  settingsOnly: !fs.existsSync(hubSetupMarker),
  rpc: (method, params) => {
    if (!daemon || appState.isQuitting) throw new Error('SDK is not running.');
    return daemon.rpc(method, params);
  },
  hasCustomServers: () => readHubConfig() !== null,
  onConfigured: () => fs.writeFileSync(hubSetupMarker, JSON.stringify({ version: 1 }) + '\n'),
  restart: async settingsOnly => {
    if (appState.isQuitting) throw new Error('Application is closing.');
    if (daemon && daemon.subprocess) {
      daemon.expectedExit = true;
      await daemon.quitForUpdate();
    }
    if (appState.isQuitting) throw new Error('Application is closing.');
    await startDaemon(settingsOnly);
  },
});

ipcMain.handle('hub-servers-scan', event => {
  if (!rendererWindow || event.sender !== rendererWindow.webContents) throw new Error('Unknown window.');
  return hubs.scan();
});
ipcMain.handle('hub-servers-select', (event, endpoint) => {
  if (!rendererWindow || event.sender !== rendererWindow.webContents) throw new Error('Unknown window.');
  return hubs.select(endpoint);
});
ipcMain.handle('hub-startup-state', event => {
  if (!rendererWindow || event.sender !== rendererWindow.webContents) throw new Error('Unknown window.');
  return { settingsOnly: hubs.settingsOnly };
});
ipcMain.handle('hub-servers-prepare', event => {
  if (!rendererWindow || event.sender !== rendererWindow.webContents) throw new Error('Unknown window.');
  return hubs.prepare();
});
ipcMain.handle('hub-servers-check', (event, endpoint) => {
  if (!rendererWindow || event.sender !== rendererWindow.webContents) throw new Error('Unknown window.');
  return hubs.checkCustom(endpoint);
});
ipcMain.handle('hub-servers-config', event => {
  if (!rendererWindow || event.sender !== rendererWindow.webContents) throw new Error('Unknown window.');
  return readHubConfig();
});

let isLbryFirstRunning = false;
const startLbryFirst = async () => {
  if (isLbryFirstRunning) {
    console.log('LbryFirst already running');
    handleLbryFirstLaunched();
    return;
  }

  console.log('LbryFirst: Starting...');

  try {
    lbryFirst = new LbryFirstInstance();
    lbryFirst.on('exit', e => {
      if (!isDev) {
        lbryFirst = null;
        isLbryFirstRunning = false;
        if (!appState.isQuitting) {
          dialog.showErrorBox(
            'LbryFirst has Exited',
            'The lbryFirst may have encountered an unexpected error, or another lbryFirst instance is already running. \n\n',
            e
          );
        }
        app.quit();
      }
    });
  } catch (e) {
    console.log('LbryFirst: Failed to create new instance\n\n', e);
  }

  console.log('LbryFirst: Running...');

  try {
    await lbryFirst.launch();
    handleLbryFirstLaunched();
  } catch (e) {
    isLbryFirstRunning = false;
    console.log('LbryFirst: Failed to start\n', e);
  }
};

const handleLbryFirstLaunched = () => {
  isLbryFirstRunning = true;
  rendererWindow.webContents.send('lbry-first-launched');
};

// When we are starting the app, ensure there are no other apps already running
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  // Another instance already has a lock, abort
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    // Send the url to the app to navigate first, then focus
    if (rendererWindow) {
      // External uri (last item on argv):
      const EXTERNAL_URI = (argv.length) ? argv[argv.length - 1] : '';
      // Handle protocol requests for windows and linux
      const platforms = (process.platform === 'win32' || process.platform === 'linux');
      // Is LBRY protocol
      const isProtocolURI = String(EXTERNAL_URI).startsWith(PROTOCOL + '://');
      // External protocol requested:
      if (platforms  && isProtocolURI) {
        let URI = EXTERNAL_URI;
        // Keep only command line / deep linked arguments
        // Windows normalizes URIs when they're passed in from other apps. On Windows, this tries to
        // restore the original URI that was typed.
        //   - If the URI has no path, Windows adds a trailing slash. LBRY URIs can't have a slash with no
        //     path, so we just strip it off.
        //   - In a URI with a claim ID, like lbry://channel#claimid, Windows interprets the hash mark as
        //     an anchor and converts it to lbry://channel/#claimid. We remove the slash here as well.
        //   - ? also interpreted as an anchor, remove slash also.
        if (process.platform === 'win32') {
          URI = URI.replace(/\/$/, '')
            .replace('/#', '#')
            .replace('/?', '?');
        }

        rendererWindow.webContents.send('open-uri-requested', URI);
      }

      rendererWindow.show();
    }
  });

  app.on('ready', async () => {
    try {
      await startDaemon(hubs.settingsOnly);
    } catch (error) {
      dialog.showErrorBox('SDK startup failed', error.message);
      app.exit(1);
      return;
    }
    startSandbox();

      if (isDev && !process.argv.includes('--skip-devtools')) {
      await installDevtools();
    }
    rendererWindow = createWindow(appState);
    attachDownloadNotifications(rendererWindow);
    tray = createTray(rendererWindow);

    if (!isDev) {
      rendererWindow.webContents.on('devtools-opened', () => {
        // Send a message to the renderer process so we can log a security warning
        rendererWindow.webContents.send('devtools-is-opened');
      });
    }

    // If an "Origin" header is passed, the SDK will check that it is set to allow that origin in the daemon_settings.yml
    // By default, electron sends http://localhost:{port} as the origin for POST requests
    // https://github.com/electron/electron/issues/7931#issuecomment-361759277
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      if (details.method === 'POST' && details.requestHeaders['Content-Type'] === 'application/json-rpc') {
        delete details.requestHeaders['Origin'];
      }
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    });
  });
}

app.on('activate', () => {
  if (rendererWindow) {
    rendererWindow.show();
  }
});

app.on('will-quit', event => {
  appState.isQuitting = true;

  if (daemon) {
    event.preventDefault();
    if (!appState.waitingForDaemon) {
      appState.waitingForDaemon = true;
      daemon.quit().then(() => {
        daemon = null;
        app.quit();
      }).catch(error => {
        dialog.showErrorBox('SDK shutdown failed', error.message);
        app.exit(1);
      });
    }
  }
  if (lbryFirst) {
    lbryFirst.quit();
    event.preventDefault();
  }

  if (rendererWindow) {
    tray.destroy();
    rendererWindow = null;
  }
});

app.on('will-finish-launching', () => {
  // Protocol handler for macOS
  app.on('open-url', (event, URL) => {
    event.preventDefault();

    if (rendererWindow) {
      rendererWindow.webContents.send('open-uri-requested', URL);
      rendererWindow.show();
    } else {
      appState.macDeepLinkingURI = URL;
    }
  });
});

app.on('before-quit', () => {
  appState.isQuitting = true;
});

ipcMain.handle('get-file-details-from-path', async (event, path) => {
    const isFfMp4 = (ffprobeResults) => {
      return ffprobeResults &&
      ffprobeResults.format &&
      ffprobeResults.format.format_name &&
      ffprobeResults.format.format_name.includes('mp4');
    };
    const folders = path.split(/[\\/]/);
    const name = folders[folders.length - 1];
    let duration = 0, size = 0, mimeType;
    try {
      await fs.promises.stat(path);
      let ffprobeResults;
      try {
        ffprobeResults = await probe(path);
        duration = ffprobeResults.format.duration;
        size = ffprobeResults.format.size;
      } catch (e) {
      }
      let fileReadResult;
      if (size < MAX_IPC_SEND_BUFFER_SIZE) {
        try {
          fileReadResult = await fs.promises.readFile(path);
        } catch (e) {

        }
      }
      // TODO: use mmmagic to inspect file and get mime type
      mimeType = isFfMp4(ffprobeResults) ? 'video/mp4' : mime.getType(name);
      const fileData = {name, mime: mimeType || undefined, path, duration: duration, size, buffer: fileReadResult };
      return fileData;
    } catch (e) {
      // no stat
      return { error: 'no file' };
    }
});

ipcMain.on('get-disk-space', async (event) => {
  try {
    const { data_dir } = await Lbry.settings_get();
    const diskSpace = await getDiskSpace(path.join(data_dir, 'blobfiles'));
    if (!event.sender.isDestroyed()) event.reply('send-disk-space', { diskSpace });
  } catch (e) {
    if (!event.sender.isDestroyed()) event.reply('send-disk-space', { error: e.message || e });
    console.log('Failed to get disk space', e);
  }
});

ipcMain.on('version-info-requested', event => {
  event.reply('version-info-received', updates.versionInfo());
});

ipcMain.on('launch-lbry-first', async () => {
  try {
    await startLbryFirst();
  } catch (e) {
    console.log('Failed to start LbryFirst');
    console.log(e);
  }
});

process.on('uncaughtException', async error => {
  console.log(error);
  dialog.showErrorBox('Error Encountered', `Caught error: ${error}`);
  appState.isQuitting = true;
  try { if (daemon) await daemon.quit(); } finally { app.exit(1) }
});

autoUpdater.logger = require('electron-log');
const updates = new DesktopUpdater(autoUpdater, {
  enabled: app.isPackaged && desktopSettings.autoUpdates === true && process.platform === 'win32',
  version: pjson.version,
  stopSdk: async () => {
    appState.isQuitting = true;
    try {
      if (daemon) await daemon.quitForUpdate();
      daemon = null;
    } catch (error) {
      appState.isQuitting = false;
      throw error;
    }
  },
  onError: (error, installing) => {
    console.error('Desktop update failed:', error.message);
    if (installing) {
      appState.isQuitting = false;
      dialog.showErrorBox('Update could not be installed', error.message + '\nPlease restart LBRY Desktop NG.');
    }
  },
});

registerUpdaterIpc({ ipcMain, updates, getWindow: () => rendererWindow, rendererURL });
