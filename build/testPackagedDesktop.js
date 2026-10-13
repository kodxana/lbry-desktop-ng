/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
const root = path.resolve(__dirname, '..');
const WebSocket = require(root + '/node_modules/ws');
const { createProfile, assertPortsAvailable } = require(root + '/electron/testProfile.cjs');
const settings = require(root + '/desktop-settings.json');
const { GENESIS } = require(root + '/electron/hubServers.cjs');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const output = path.join(root, 'dist/package-tests');
fs.mkdirSync(output, { recursive: true });

function request(port, pathname, payload) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: pathname,
        method: payload ? 'POST' : 'GET',
        headers: payload ? { 'Content-Type': 'application/json' } : {},
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    req.setTimeout(2000, () => req.destroy(new Error('HTTP timeout')));
    req.on('error', reject);
    req.end(payload && JSON.stringify(payload));
  });
}

async function until(check, message, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await delay(250);
  }
  throw new Error(message);
}

async function main() {
  const development = process.argv.includes('--development');
  const linux = process.platform === 'linux';
  const executable = development
    ? process.execPath
    : path.join(
        root,
        linux ? 'dist/ng-linux/linux-unpacked/lbry-desktop-ng' : 'dist/ng/win-unpacked/LBRY Desktop NG.exe'
      );
  const label = process.platform + (development ? '-development' : '');
  assert(label && fs.existsSync(executable));
  const profile = createProfile(fs.mkdtempSync(path.join(output, label + '-profile-')), settings);
  const messagesSource = path.join(root, 'static/app-strings.json');
  const originalMessages = fs.readFileSync(messagesSource);
  const messagesOutput = path.join(profile.root, 'app-strings.json');
  if (development) fs.writeFileSync(messagesOutput, originalMessages);
  await assertPortsAvailable(settings);
  const sockets = new Set();
  const hub = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk;
      while (buffer.includes('\n')) {
        const end = buffer.indexOf('\n');
        const call = JSON.parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        const replies = {
          'server.version': ['desktop-smoke-fixture', '0.113.0'],
          'server.features': { genesis_hash: GENESIS, protocol_min: '0.113.0', protocol_max: '0.113.0' },
          'server.peers.subscribe': [],
          'server.ping': null,
          'blockchain.headers.subscribe': { height: 0, hex: '' },
          'blockchain.block.headers': { count: 0, hex: '' },
          'blockchain.address.subscribe': (call.params || []).map(() => null),
          'blockchain.address.unsubscribe': true,
        };
        const reply = Object.prototype.hasOwnProperty.call(replies, call.method)
          ? { result: replies[call.method] }
          : { error: { code: -32601, message: 'Fixture method unavailable' } };
        socket.write(JSON.stringify({ jsonrpc: '2.0', id: call.id, ...reply }) + '\n');
      }
    });
  });
  await new Promise((resolve) => hub.listen(0, '127.0.0.1', resolve));
  const endpoint = '127.0.0.1:' + hub.address().port;
  fs.writeFileSync(
    profile.config,
    JSON.stringify({
      blockchain_name: 'lbrycrd_regtest',
      lbryum_servers: [endpoint],
      components_to_skip: [
        'blob_manager',
        'wallet_server_payments',
        'dht',
        'hash_announcer',
        'file_manager',
        'disk_space',
        'background_downloader',
        'peer_protocol_server',
        'upnp',
        'exchange_rate_manager',
        'tracker_announcer_component',
        'libtorrent_component',
      ],
    })
  );
  const portSocket = net.createServer();
  await new Promise((resolve) => portSocket.listen(0, '127.0.0.1', resolve));
  const debugPort = portSocket.address().port;
  await new Promise((resolve) => portSocket.close(resolve));
  const log = fs.createWriteStream(path.join(output, label + '-desktop.log'));
  const app = spawn(
    executable,
    [
      ...(development ? [path.join(root, 'electron/devServer.js'), '--skip-devtools'] : []),
      '--disable-gpu',
      '--enable-logging=stderr',
      '--ng-profile=' + profile.root,
      '--remote-debugging-port=' + debugPort,
      '--remote-debugging-address=127.0.0.1',
    ],
    {
      cwd: development ? root : path.dirname(executable),
      windowsHide: true,
      env: {
        ...process.env,
        NODE_ENV: development ? 'development' : 'production',
        ...(development ? { LBRY_I18N_OUTPUT_FILE: messagesOutput } : {}),
      },
    }
  );
  app.stdout.pipe(log, { end: false });
  app.stderr.pipe(log, { end: false });
  let closed;
  const exited = new Promise((resolve, reject) => {
    app.once('error', reject);
    app.on('close', (code, signal) => {
      closed = { code, signal };
      resolve(closed);
    });
  });
  exited.catch(() => {});
  let ws;
  try {
    // The target URL appears before its document commits. Attaching DevTools at
    // that point can create the empty document's contexts before Electron runs
    // the preload. Wait for our parsed HTML title before attaching the debugger.
    const page = await until(
      async () => {
        assert(!closed, 'Desktop exited before opening its window: ' + JSON.stringify(closed));
        try {
          return (await request(debugPort, '/json/list')).find(
            (item) =>
              item.type === 'page' &&
              item.title === 'LBRY' &&
              (development ? item.url.startsWith('http://localhost:') : item.url.includes('index.html'))
          );
        } catch (_) {
          return false;
        }
      },
      'No renderer target',
      development ? 240000 : 60000
    );
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });
    let nextId = 0;
    const pending = new Map();
    const contexts = new Map();
    ws.on('message', (bytes) => {
      const message = JSON.parse(bytes);
      if (message.method === 'Runtime.executionContextCreated') {
        const context = message.params.context;
        contexts.set(context.id, context);
      } else if (message.method === 'Runtime.executionContextDestroyed') {
        contexts.delete(message.params.executionContextId);
      } else if (message.method === 'Runtime.executionContextsCleared') {
        contexts.clear();
      }
      const waiting = pending.get(message.id);
      if (waiting) {
        clearTimeout(waiting.timer);
        pending.delete(message.id);
        message.error ? waiting.reject(message.error) : waiting.resolve(message.result);
      }
    });
    const cdp = (method, params) => {
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error('CDP timeout: ' + method));
        }, 10000);
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, method, params }));
      });
    };
    // Observe the real main-world context before sending any page JavaScript.
    const { frameTree } = await cdp('Page.getFrameTree');
    await cdp('Runtime.enable');
    const context = await until(
      () =>
        [...contexts.values()].find(
          (candidate) =>
            candidate.auxData &&
            candidate.auxData.isDefault &&
            candidate.auxData.frameId === frameTree.frame.id &&
            candidate.origin === (development ? new URL(page.url).origin : 'file://')
        ),
      'No application JavaScript context'
    ).catch(async (error) => {
      console.error('Contexts:', [...contexts.values()]);
      console.error('Frame:', JSON.stringify(await cdp('Page.getFrameTree')));
      throw error;
    });
    const evaluate = async (expression) => {
      const result = await cdp('Runtime.evaluate', {
        expression,
        contextId: context.id,
        returnByValue: true,
        awaitPromise: true,
      });
      assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const rpc = async (method) => {
      const result = await request(settings.apiPort, '/', { method, params: {} });
      assert(!result.error, JSON.stringify(result.error));
      return result.result;
    };
    // Wait for the browser bundle to render before starting asynchronous IPC checks.
    let setupPage;
    try {
      await until(async () => {
        assert(!closed, 'Desktop exited before rendering setup: ' + JSON.stringify(closed));
        try {
          setupPage = await evaluate(
            "({readyState:document.readyState, text:document.body ? document.body.innerText.slice(0, 2000) : ''})"
          );
          // A stalled external analytics script can keep readyState interactive.
          // The actual setup content proves that the application's bundle ran.
          return setupPage.text.includes('Choose a wallet hub');
        } catch (error) {
          if (error.code === -32000 && error.message === 'Execution context was destroyed.') return false;
          throw error;
        }
      }, 'Hub picker did not render');
    } catch (error) {
      console.error('Setup page at failure:', setupPage);
      throw error;
    }
    console.log('PASS: setup content ready; document state: ' + setupPage.readyState);
    assert.deepEqual(
      await evaluate(
        '({require:typeof require, process:typeof process, Buffer:typeof Buffer, sandboxed:window.lbryDesktop.sandboxed, frozen:Object.isFrozen(window.lbryDesktop)})'
      ),
      {
        require: 'undefined',
        process: 'undefined',
        Buffer: 'undefined',
        sandboxed: true,
        frozen: true,
      },
      'The application renderer must be isolated, sandboxed and have no Node globals'
    );
    const runtime = await evaluate('window.lbryDesktop.electron');
    assert.equal(runtime, require(root + '/package.json').devDependencies.electron);
    console.log('PASS: ' + label + ' runs Electron ' + runtime);
    const metadata = await evaluate("window.lbryDesktop.info('metadata')");
    assert.equal(metadata.ok, true);
    assert.equal(typeof metadata.locale, 'string');
    const appVersion = metadata.version;
    assert.equal(appVersion, require(root + '/package.json').version, 'Electron must load the application metadata');
    const updateState = await evaluate("window.lbryDesktop.updater('state')");
    assert.equal(updateState.ok, true, 'Updater IPC must recognize the packaged/development renderer');
    assert.equal(updateState.state.enabled, !development && process.platform === 'win32');
    assert.equal(updateState.state.accepted, false, 'Startup must never supply install consent');
    assert.deepEqual(
      await evaluate("window.lbryDesktop.selectFile({type: 'invalid'})"),
      { ok: false, error: 'invalid' },
      'The file selection handler must recognize the application renderer before validating the request'
    );
    await until(
      () => evaluate("Boolean(document.querySelector('fieldset') && !document.querySelector('fieldset').disabled)"),
      'Hub probe did not finish'
    );
    assert.deepEqual((await rpc('status')).startup_status, {});
    assert.equal(fs.readdirSync(profile.wallet).length, 0);
    const before = await evaluate(
      "({text:document.body.innerText, background:getComputedStyle(document.body).backgroundColor, theme:document.querySelector('.setup-layout').getAttribute('theme')})"
    );
    assert(before.text.includes(endpoint));
    assert.equal(before.theme, 'dark', 'Hub setup must retain its dark theme');
    const screenshot = await cdp('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.join(root, 'dist/ci'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist/ci', label + '-setup.png'), Buffer.from(screenshot.data, 'base64'));
    console.log('PASS: ' + label + ' rendered the hub picker before opening a wallet');
    await evaluate("document.querySelectorAll('input[type=radio]')[1].click()");
    await evaluate(
      "Array.from(document.querySelectorAll('button')).find(button=>button.innerText.includes('Start syncing')).click()"
    );
    await until(async () => {
      try {
        const status = await rpc('status');
        return (
          status.is_running &&
          status.wallet &&
          status.wallet.history_sync &&
          status.wallet.history_sync.state === 'complete' &&
          status.wallet.history_sync.connected &&
          fs.existsSync(path.join(profile.root, 'hub-setup-complete.json'))
        );
      } catch (error) {
        if (['ECONNREFUSED', 'ECONNRESET'].includes(error.code)) return false;
        throw error;
      }
    }, 'Packaged wallet did not finish fixture sync');
    assert.equal((await rpc('wallet_balance')).total, '0.0');
    const addressCount = (await rpc('address_list')).items.length;
    assert(addressCount > 0);
    assert(fs.existsSync(path.join(profile.root, 'hub-setup-complete.json')));
    // Exercise both shutdown entry points: renderer Quit and native window close.
    await evaluate(
      development
        ? 'setTimeout(() => window.close(), 100); true'
        : "setTimeout(() => window.lbryDesktop.windowControl('quit'), 100); true"
    );
    let stopTimer;
    const stopped = await Promise.race([
      exited,
      new Promise((resolve) => {
        stopTimer = setTimeout(() => resolve(null), 35000);
      }),
    ]);
    clearTimeout(stopTimer);
    assert(stopped && stopped.code === 0 && stopped.signal === null, JSON.stringify(stopped));
    await assertPortsAvailable(settings);
    const sdkLog = fs.readFileSync(path.join(profile.logs, 'daemon-console.log'), 'utf8');
    assert.equal((sdkLog.match(/finished shutting down/g) || []).length, 2);
    assert(!sdkLog.includes('Task was destroyed but it is pending!'));
    assert.deepEqual(fs.readFileSync(messagesSource), originalMessages, 'Smoke test changed source translations');
    if (development) {
      const collectedMessages = JSON.parse(fs.readFileSync(messagesOutput, 'utf8'));
      assert(collectedMessages['Choose a wallet hub'], 'Development translation collection did not run');
    }
    const evidence = {
      executable: path.basename(executable),
      label,
      appVersion,
      rendererLoaded: true,
      hubPicker: before,
      walletBalance: '0.0',
      addressCount,
      cleanSdkShutdowns: 2,
      desktopExitCode: 0,
    };
    fs.mkdirSync(path.join(root, 'dist/ci'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'dist/ci', development ? 'development-smoke.json' : 'packaged-smoke.json'),
      JSON.stringify(evidence, null, 2)
    );
    console.log('PASS: ' + label + ' renderer, hub selection, fixture wallet sync and clean desktop/SDK shutdown');
  } finally {
    if (ws) ws.close();
    if (!closed) {
      try {
        const owner = await request(settings.apiPort, '/', { method: 'settings_get', params: {} });
        if (owner.result && owner.result.data_dir === profile.data) {
          await request(settings.apiPort, '/', { method: 'stop', params: {} });
        }
      } catch (_) {}
      app.kill('SIGTERM');
    }
    sockets.forEach((socket) => socket.destroy());
    await new Promise((resolve) => hub.close(resolve));
    log.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
