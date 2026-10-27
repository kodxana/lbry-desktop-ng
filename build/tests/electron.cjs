/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, ipcMain, session } = require('electron');
ipcMain.on('wallet-cloud-sync-enabled', (event) => {
  event.returnValue = true;
});
const { registerPasswordStorage } = require('../../electron/passwordStorage.cjs');
const passwordBackend = require('./passwordBackend.cjs')();
let activeWindow;
const passwordNotices = [];
let acknowledgeNotice;
let holdNotice = false;
let failForget = false;
let passwordStore;
let configureWindow;
let media;
let activePhase;

const output = path.resolve(__dirname, '../../dist/renderer-tests');
const root = fs.mkdtempSync(path.join(output, 'profile-'));
app.setPath('userData', root);
const graphics = process.argv.includes('--three');
const comics = process.argv.includes('--comics');
const mediaOnly = process.argv.includes('--media');
const importOnly = process.argv.includes('--wallet-import');
if (graphics) {
  // Exercise real WebGL 2 rendering deterministically on GPU-less CI runners.
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
} else {
  app.disableHardwareAcceleration();
}
app.on('window-all-closed', () => {});
const timer = setTimeout(() => {
  console.error('Renderer regression tests timed out');
  app.exit(1);
}, 90000);

async function run(phase) {
  const window = new BrowserWindow({
    show: false,
    ...(phase === 'uiComponents' ? { width: 1280, height: 800 } : {}),
    ...(phase === 'collections' ? { width: 1280, height: 900 } : {}),
    ...(phase === 'walletImport' ? { width: 1280, height: 1000 } : {}),
    ...(phase === 'comics' ? { width: 1100, height: 750 } : {}),
    webPreferences: {
      nodeIntegration: true,
      // Fixture code creates files and inspects ZIPs. A separate sandbox suite
      // exercises the production preload with no renderer Node privileges.
      contextIsolation: false,
      sandbox: false,
      preload: path.join(output, 'fixture-preload.js'),
      additionalArguments: [
        '--lbry-renderer-url=' + require('url').pathToFileURL(path.join(output, 'index.html')).href,
      ],
      plugins: true,
      // Hidden fixture windows still need animation frames for the real viewers.
      backgroundThrottling: false,
      offscreen: ['documents', 'three', 'comics', 'markdownEditor', 'media', 'walletImport'].includes(phase),
    },
  });
  activeWindow = window;
  window.webContents.on('preload-error', (_event, file, error) => console.error('Preload failed:', file, error));
  window.webContents.on('console-message', (event) => {
    if (event.level === 'error') console.error(event.message);
  });
  activePhase = phase;
  if (phase === 'windowControls') configureWindow(window);
  try {
    await new Promise((resolve, reject) => {
      ipcMain.once('regression-result', (event, result) => {
        try {
          assert.equal(event.sender, window.webContents);
          assert.equal(result.phase, phase);
          if (result.error) throw new Error(result.error);
          console.log('PASS: ' + result.message);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      window.webContents.once('render-process-gone', (_event, details) => reject(new Error(JSON.stringify(details))));
      window.loadFile(path.join(output, 'index.html'), { query: { phase } }).catch(reject);
    });
  } finally {
    ipcMain.removeAllListeners('regression-result');
    window.destroy();
  }
}

app
  .whenReady()
  .then(async () => {
    ipcMain.handle('fixture-media-action', async (event, action) => {
      assert.equal(activePhase, 'media');
      assert.equal(event.sender, activeWindow.webContents);
      if (action === 'fullscreen') {
        await activeWindow.webContents.executeJavaScript('document.querySelector(".player-fullscreen").click()', true);
      } else {
        assert(['capture-dark', 'capture-light', 'capture-compact', 'capture-captions'].includes(action));
        const contents = activeWindow.webContents;
        await contents.executeJavaScript(
          'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
        );
        const painted = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Media repaint timed out')), 10000);
          contents.once('paint', (_event, _rect, image) => {
            clearTimeout(timeout);
            resolve(image);
          });
          contents.invalidate();
        });
        assert(!painted.isEmpty());
        fs.writeFileSync(
          path.resolve(`dist/ci/media-${action.slice(8)}.png`),
          (await contents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG()
        );
      }
    });
    ipcMain.handle('fixture-comic-fullscreen', async (event, label) => {
      assert.equal(activePhase, 'comics');
      assert.equal(event.sender, activeWindow.webContents);
      assert(['Fullscreen', 'Exit fullscreen'].includes(label));
      await activeWindow.webContents.executeJavaScript(
        'document.querySelector(' + JSON.stringify('[aria-label="' + label + '"]') + ').click()',
        true
      );
    });
    ipcMain.handle('fixture-comic-capture', async (event, theme) => {
      assert.equal(activePhase, 'comics');
      assert.equal(event.sender, activeWindow.webContents);
      assert(['dark', 'light', 'failure'].includes(theme));
      fs.writeFileSync(
        path.resolve(`dist/ci/comic-${theme}.png`),
        (await activeWindow.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG()
      );
    });
    ipcMain.handle('fixture-three-capture', async (event) => {
      assert.equal(activePhase, 'three');
      assert.equal(event.sender, activeWindow.webContents);
      fs.writeFileSync(
        path.resolve('dist/ci/three-preview.png'),
        (await activeWindow.webContents.capturePage()).toPNG()
      );
    });
    ipcMain.handle('fixture-controls-focus', async (event) => {
      assert(['accessibleControls', 'collections', 'reactState', 'formsAndDates', 'media'].includes(activePhase));
      assert.equal(event.sender, activeWindow.webContents);
      activeWindow.webContents.debugger.attach('1.3');
      await activeWindow.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true });
    });
    ipcMain.handle('fixture-controls-key', async (event, key) => {
      assert(['accessibleControls', 'collections', 'fileUploads', 'reactState', 'media'].includes(activePhase));
      assert.equal(event.sender, activeWindow.webContents);
      const codes = {
        k: 75,
        Tab: 9,
        Home: 36,
        End: 35,
        ArrowDown: 40,
        ArrowUp: 38,
        Enter: 13,
        Escape: 27,
        ' ': 32,
      };
      assert(Object.hasOwn(codes, key));
      const debuggerApi = activeWindow.webContents.debugger;
      const attached = debuggerApi.isAttached();
      if (!attached) debuggerApi.attach('1.3');
      try {
        for (const type of ['keyDown', 'keyUp']) {
          await debuggerApi.sendCommand('Input.dispatchKeyEvent', {
            type,
            key,
            code: key === ' ' ? 'Space' : key,
            windowsVirtualKeyCode: codes[key],
          });
        }
      } finally {
        if (!attached) debuggerApi.detach();
      }
    });
    ipcMain.handle('fixture-collection-mouse', async (event, { type, x, y }) => {
      assert.equal(activePhase, 'collections');
      assert.equal(event.sender, activeWindow.webContents);
      assert(['mousePressed', 'mouseMoved', 'mouseReleased'].includes(type));
      const [width, height] = activeWindow.getContentSize();
      assert(Number.isFinite(x) && x >= 0 && x < width);
      assert(Number.isFinite(y) && y >= 0 && y < height);
      await activeWindow.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {
        type,
        x,
        y,
        button: 'left',
        buttons: type === 'mouseReleased' ? 0 : 1,
        clickCount: 1,
      });
    });
    ipcMain.handle('fixture-controls-click-outside', async (event) => {
      assert.equal(activePhase, 'accessibleControls');
      assert.equal(event.sender, activeWindow.webContents);
      const [width, height] = activeWindow.getContentSize();
      for (const type of ['mousePressed', 'mouseReleased']) {
        await activeWindow.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {
          type,
          x: width - 8,
          y: height - 8,
          button: 'left',
          clickCount: 1,
        });
      }
    });
    ipcMain.handle('fixture-controls-capture', async (event, theme) => {
      assert.equal(activePhase, 'accessibleControls');
      assert.equal(event.sender, activeWindow.webContents);
      assert(['dark', 'light'].includes(theme));
      fs.writeFileSync(
        path.resolve(`dist/ci/controls-${theme}.png`),
        (await activeWindow.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG()
      );
    });
    ipcMain.handle('fixture-wallet-import-capture', async (event) => {
      assert.equal(activePhase, 'walletImport');
      assert.equal(event.sender, activeWindow.webContents);
      fs.writeFileSync(
        path.resolve('dist/ci/wallet-import.png'),
        (await activeWindow.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG()
      );
    });
    ipcMain.handle('fixture-editor-capture', async (event, theme) => {
      assert.equal(activePhase, 'markdownEditor');
      assert.equal(event.sender, activeWindow.webContents);
      assert(['dark', 'light'].includes(theme));
      // Hidden windows can retain an older compositor frame after a theme change.
      const contents = activeWindow.webContents;
      const painted = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Editor repaint timed out')), 10000);
        contents.once('paint', (_event, _rect, image) => {
          clearTimeout(timeout);
          resolve(image);
        });
        contents.invalidate();
      });
      fs.writeFileSync(path.resolve(`dist/ci/editor-${theme}.png`), painted.toPNG());
    });
    ipcMain.handle('fixture-editor-input', async (event, input) => {
      assert.equal(activePhase, 'markdownEditor');
      assert.equal(event.sender, activeWindow.webContents);
      if (input.composition !== undefined) {
        await activeWindow.webContents.debugger.sendCommand('Input.imeSetComposition', {
          text: input.composition,
          selectionStart: input.composition.length,
          selectionEnd: input.composition.length,
        });
      } else if (input.text !== undefined) {
        await activeWindow.webContents.debugger.sendCommand('Input.insertText', { text: input.text });
      } else {
        const key = { keyCode: input.key, modifiers: input.modifiers || [] };
        activeWindow.webContents.sendInputEvent({ type: 'keyDown', ...key });
        activeWindow.webContents.sendInputEvent({ type: 'keyUp', ...key });
      }
    });
    assert.equal(process.versions.electron, require('../../package.json').devDependencies.electron);
    await require('./devMode.cjs')();
    await require('./windowState.cjs')();
    await require('./rendererLifecycle.cjs')();
    await require('../testDesktopUpdates')();
    require('./updater.cjs')(() => activeWindow, require('url').pathToFileURL(path.join(output, 'index.html')).href);
    require('./contextMenu.cjs')(
      () => activeWindow,
      require('url').pathToFileURL(path.join(output, 'index.html')).href
    );
    require('./desktopInfo.cjs')(
      root,
      () => activeWindow,
      require('url').pathToFileURL(path.join(output, 'index.html')).href
    );
    configureWindow = require('./windowControls.cjs')(
      () => activeWindow,
      require('url').pathToFileURL(path.join(output, 'index.html')).href
    );
    require('./native.cjs')(
      root,
      () => activeWindow,
      require('url').pathToFileURL(path.join(output, 'index.html')).href
    );
    passwordStore = registerPasswordStorage({
      ipcMain,
      safeStorage: passwordBackend,
      directory: root,
      getWindow: () => activeWindow,
      rendererURL: require('url').pathToFileURL(path.join(output, 'index.html')).href,
      cookies: session.defaultSession.cookies,
      dialog: {
        showMessageBox: async (_window, options) => {
          passwordNotices.push(options);
          if (holdNotice) {
            await new Promise((resolve) => {
              acknowledgeNotice = resolve;
            });
          }
        },
      },
      domains: ['lbry.tv'],
    });
    const forget = passwordStore.forget.bind(passwordStore);
    passwordStore.forget = () => {
      if (failForget) throw new Error('Synthetic forget failure');
      return forget();
    };
    ipcMain.handle('test-password-storage', (_event, operation) => {
      if (operation === 'reset') {
        try {
          fs.unlinkSync(passwordStore.file);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      } else if (operation === 'unavailable') passwordBackend.available = false;
      else if (operation === 'available') passwordBackend.available = true;
      else if (operation === 'hold-notice') holdNotice = true;
      else if (operation === 'acknowledge') {
        holdNotice = false;
        acknowledgeNotice();
      } else if (operation === 'fail-forget') failForget = true;
      else if (operation === 'allow-forget') failForget = false;
      return {
        notices: passwordNotices,
        state: fs.existsSync(passwordStore.file) ? JSON.parse(fs.readFileSync(passwordStore.file)) : null,
      };
    });
    const blocked = [];
    const analyticsRequests = [];
    const integrationRequests = [];
    media = await require('./mediaServer.cjs')();
    ipcMain.handle('fixture-media', (event) => {
      assert.equal(event.sender, activeWindow.webContents);
      return { origin: media.origin, requests: media.requests };
    });
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
      (details, callback) => {
        if (
          activePhase === 'media' &&
          activeWindow &&
          !activeWindow.isDestroyed() &&
          details.webContentsId === activeWindow.webContents.id &&
          new URL(details.url).origin === media.origin
        ) {
          callback({ cancel: false });
          return;
        }
        if (activePhase === 'browserIntegrations' && ['subFrame', 'script'].includes(details.resourceType)) {
          integrationRequests.push({ type: details.resourceType, url: details.url });
        } else if (['analytics', 'analyticsEnabled'].includes(activePhase)) {
          analyticsRequests.push({ phase: activePhase, url: details.url });
        } else {
          blocked.push(details.url);
        }
        callback({ cancel: true });
      }
    );
    for (const phase of importOnly
      ? ['walletImport']
      : mediaOnly
        ? ['media']
        : graphics
          ? ['three']
          : comics
            ? ['comics']
            : [
                'bundling',
                'fresh',
                'legacy',
                'restart',
                'stateUpdates',
                'reactState',
                'uiComponents',
                'accessibleControls',
                'collections',
                'browserIntegrations',
                'formsAndDates',
                'markdownEditor',
                'documents',
                'fileDialogs',
                'fileUploads',
                'windowControls',
                'contextMenu',
                'updater',
                'updaterRestart',
                'wallet',
                'accountOutage',
                'downloadNotifications',
                'passwords',
                'passwordRestart',
                'analytics',
                'analyticsEnabled',
                'analyticsDisabled',
                'analyticsUnconfigured',
              ]) {
      await run(phase);
    }
    assert.deepEqual(
      analyticsRequests,
      graphics || comics || mediaOnly || importOnly
        ? []
        : [
            { phase: 'analytics', url: 'https://analytics.lbry.com/matomo.js' },
            { phase: 'analyticsEnabled', url: 'https://analytics.lbry.com/matomo.js' },
          ],
      'Only explicit analytics opt-in may request the tracking script'
    );
    assert.deepEqual(blocked, [], 'Unexpected renderer requests: ' + JSON.stringify(blocked));
    if (!graphics && !comics && !mediaOnly && !importOnly) {
      const purchases = integrationRequests.filter((request) => request.type === 'subFrame');
      assert(purchases.length >= 2, 'The purchase fixture must exercise signed iframe destinations');
      for (const { url } of purchases) {
        const destination = new URL(url);
        assert.equal(destination.origin, 'https://buy.moonpay.io');
        assert.match(destination.searchParams.get('walletAddress'), /^fixture-address-[abc]$/);
        const [query, signature] = destination.search.split('&signature=');
        assert.equal(
          decodeURIComponent(signature),
          require('crypto').createHmac('sha256', 'fixture-moonpay-key').update(query).digest('base64')
        );
      }
      assert.deepEqual(
        integrationRequests.filter((request) => request.type === 'script'),
        [{ type: 'script', url: 'https://www.google.com/recaptcha/api.js?onload=onloadcallback&render=explicit' }]
      );
      console.log('PASS: purchase URLs and CAPTCHA script verified with all integration network requests blocked');
    }
    console.log('PASS: external requests blocked; no SDK calls; disposable IndexedDB profile');
    await media.close();
    clearTimeout(timer);
    app.exit(0);
  })
  .catch((error) => {
    console.error(error);
    clearTimeout(timer);
    app.exit(1);
  });
