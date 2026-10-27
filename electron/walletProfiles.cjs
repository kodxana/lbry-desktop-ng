const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createProfile } = require('./testProfile.cjs');

const ID = /^[a-f0-9]{32}$/;
const SETUP = 'wallet-setup.json';

function syncDirectory(directory) {
  if (process.platform === 'win32') return;
  const fd = fs.openSync(directory, 'r');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function writeRecord(file, record) {
  const temporary = file + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
  try {
    writePrivate(temporary, JSON.stringify(record));
    fs.renameSync(temporary, file);
    syncDirectory(path.dirname(file));
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function writePrivate(file, bytes) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function ownedDirectory(parent, name) {
  const directory = path.join(parent, name);
  fs.mkdirSync(directory, { recursive: true });
  if (
    fs.lstatSync(directory).isSymbolicLink() ||
    path.dirname(fs.realpathSync(directory)) !== fs.realpathSync(parent)
  ) {
    throw new Error('Wallet profile directory is not local to this application.');
  }
  return directory;
}

function readSetup(profile) {
  const file = path.join(profile.root, SETUP);
  if (!fs.existsSync(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (data.version !== 1 || typeof data.cloudSync !== 'boolean') throw new Error('Invalid wallet setup record.');
  return data;
}

function completeSetup(profile, kind, cloudSync) {
  if (!readSetup(profile)) writeRecord(path.join(profile.root, SETUP), { version: 1, kind, cloudSync });
  fs.rmSync(path.join(profile.root, 'wallet-setup-requested'), { force: true });
}

function openProfiles(root, settings) {
  const base = createProfile(root, settings);
  function checkDirectories(profile) {
    for (const name of ['desktop', 'data', 'wallet', 'downloads', 'logs', 'home', 'temp']) {
      ownedDirectory(profile.root, name);
    }
    if (fs.existsSync(path.join(profile.wallet, 'wallets'))) ownedDirectory(profile.wallet, 'wallets');
    return profile;
  }
  checkDirectories(base);
  const directory = ownedDirectory(base.root, 'profiles');
  const pointer = path.join(base.root, 'active-wallet-profile.json');
  function resolve(id) {
    if (id === 'original') return base;
    if (!ID.test(id)) throw new Error('Unknown wallet profile.');
    const target = path.join(directory, id);
    if (
      !fs.existsSync(target) ||
      fs.lstatSync(target).isSymbolicLink() ||
      path.dirname(fs.realpathSync(target)) !== fs.realpathSync(directory)
    )
      throw new Error('Unknown wallet profile.');
    const profile = checkDirectories(createProfile(target, settings));
    if (!readSetup(profile)) throw new Error('Wallet profile was not completed.');
    return profile;
  }
  const activeId = fs.existsSync(pointer) ? JSON.parse(fs.readFileSync(pointer, 'utf8')).id : 'original';
  const current = resolve(activeId);
  function activate(id) {
    resolve(id);
    writeRecord(pointer, { id });
  }
  function prepare(bytes) {
    const id = crypto.randomBytes(16).toString('hex');
    const profile = createProfile(path.join(directory, id), settings);
    if (bytes) {
      const wallets = ownedDirectory(profile.wallet, 'wallets');
      const destination = path.join(wallets, 'default_wallet');
      writePrivate(destination, bytes);
      if (!fs.readFileSync(destination).equals(bytes)) throw new Error('Wallet copy verification failed.');
      syncDirectory(wallets);
      syncDirectory(profile.wallet);
    }
    // The activation pointer is only changed after the complete copy and policy are durable.
    completeSetup(profile, bytes ? 'imported' : 'fresh', false);
    syncDirectory(directory);
    return id;
  }
  function list() {
    const profiles = [{ id: 'original', label: 'Original NG profile' }];
    for (const id of fs.readdirSync(directory)) {
      if (!ID.test(id)) continue;
      try {
        const profile = resolve(id);
        const setup = readSetup(profile);
        profiles.push({
          id,
          label:
            (setup.kind === 'imported' ? 'Imported wallet' : 'New wallet') +
            ' · ' +
            fs.statSync(path.join(profile.root, SETUP)).mtime.toISOString().slice(0, 16).replace('T', ' '),
        });
      } catch (_) {
        /* Incomplete copies must never be offered as usable wallets. */
      }
    }
    return profiles.filter(({ id }) => id !== activeId);
  }
  return { current, activeId, activate, prepare, list };
}

module.exports = { openProfiles, readSetup, completeSetup, ownedDirectory, writePrivate };
