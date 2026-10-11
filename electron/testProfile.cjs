const fs = require('fs');
const path = require('path');
const net = require('net');
const dgram = require('dgram');
const settings = require('../sdk-test.json');

function createProfile(root) {
  if (!path.isAbsolute(root) || path.resolve(root) === path.parse(root).root) {
    throw new Error('The SDK test profile must be an absolute directory path.');
  }
  root = path.resolve(root);
  const marker = path.join(root, 'sdk-test-profile.json');
  if (fs.existsSync(marker)) {
    if (JSON.parse(fs.readFileSync(marker, 'utf8')).appId !== settings.appId) {
      throw new Error('This directory belongs to a different application.');
    }
  } else {
    if (fs.existsSync(root) && fs.readdirSync(root).length) {
      throw new Error('Choose an empty directory for the SDK test profile: ' + root);
    }
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(marker, JSON.stringify({ appId: settings.appId }), { flag: 'wx' });
  }
  const profile = { root, config: path.join(root, 'daemon.yml'), ports: settings };
  for (const name of ['desktop', 'data', 'wallet', 'downloads', 'logs', 'home', 'temp']) {
    profile[name] = path.join(root, name);
    fs.mkdirSync(profile[name], { recursive: true });
  }
  for (const folder of ['AppData/Roaming', 'AppData/Local', 'Downloads']) {
    fs.mkdirSync(path.join(profile.home, folder), { recursive: true });
  }
  if (!fs.existsSync(profile.config)) fs.writeFileSync(profile.config, '{}\n');
  return profile;
}

function daemonFlags(profile) {
  return ['start', '--config=' + profile.config,
    '--data-dir=' + profile.data, '--wallet-dir=' + profile.wallet,
    '--download-dir=' + profile.downloads,
    '--api=127.0.0.1:' + profile.ports.apiPort,
    '--streaming-server=127.0.0.1:' + profile.ports.streamingPort,
    '--tcp-port=' + profile.ports.peerPort, '--udp-port=' + profile.ports.peerPort,
    '--no-use-upnp', '--no-share-usage-data'];
}

function daemonEnvironment(profile) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/^(LBRY_|PYTHON|_PYI_)/i.test(key)));
  return Object.assign(env, {
    HOME: profile.home,
    USERPROFILE: profile.home,
    APPDATA: path.join(profile.home, 'AppData', 'Roaming'),
    LOCALAPPDATA: path.join(profile.home, 'AppData', 'Local'),
    XDG_DATA_HOME: profile.data,
    XDG_CONFIG_HOME: profile.root,
    XDG_CACHE_HOME: profile.temp,
    TEMP: profile.temp,
    TMP: profile.temp,
    PYTHONUTF8: '1',
  });
}

async function assertPortsAvailable(ports) {
  const sockets = [];
  try {
    for (const [port, host] of [[ports.apiPort, '127.0.0.1'], [ports.streamingPort, '127.0.0.1'],
      [ports.peerPort, '0.0.0.0']]) {
      const server = net.createServer();
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen({ port, host, exclusive: true }, resolve);
      });
      sockets.push(server);
    }
    const udp = dgram.createSocket('udp4');
    sockets.push(udp);
    await new Promise((resolve, reject) => {
      udp.once('error', reject);
      udp.bind({ port: ports.peerPort, address: '0.0.0.0', exclusive: true }, resolve);
    });
  } catch (error) {
    throw new Error('An SDK test port is unavailable; no existing SDK will be used. ' + error.message);
  } finally {
    for (const socket of sockets) {
      try { await new Promise(resolve => socket.close(resolve)) } catch (_) { /* Not bound. */ }
    }
  }
}

module.exports = { createProfile, daemonFlags, daemonEnvironment, assertPortsAvailable };
