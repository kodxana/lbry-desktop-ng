const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const AdmZip = require('adm-zip');
const { readSetup, completeSetup, ownedDirectory, writePrivate } = require('./walletProfiles.cjs');

const MAX_WALLET = 8 * 1024 * 1024;
const MAX_ARCHIVE = 256 * 1024 * 1024;

function readSelection(file) {
  const fd = fs.openSync(file, 'r');
  let bytes;
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_ARCHIVE)
      throw new Error('Choose a wallet or backup ZIP smaller than 256 MB.');
    bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!count) throw new Error('The selected file changed. Choose it again.');
      offset += count;
    }
  } finally {
    fs.closeSync(fd);
  }
  if (bytes.readUInt16LE(0) === 0x4b50) {
    const entries = new AdmZip(bytes).getEntries().filter((entry) => {
      const name = entry.entryName;
      return (
        !entry.isDirectory &&
        !name.includes('\\') &&
        !name.startsWith('/') &&
        !name.split('/').some((part) => part === '..' || part === '.' || part.includes(':')) &&
        /(^|\/)wallets\/[^/]+$|^default_wallet$/.test(name)
      );
    });
    if (!entries.length || entries.length > 100) throw new Error('No supported wallet files found in this backup.');
    return entries.map((entry, index) => ({
      id: String(index),
      name: entry.entryName,
      read: () => {
        const header = entry.header;
        if (header.size > MAX_WALLET || header.flags & 1 || ![0, 8].includes(header.method)) {
          throw new Error('This wallet ZIP entry is too large or uses unsupported encryption.');
        }
        const compressed = entry.getCompressedData();
        const data =
          header.method === 0 ? compressed : zlib.inflateRawSync(compressed, { maxOutputLength: MAX_WALLET });
        if (data.length > MAX_WALLET || data.length !== header.size || zlib.crc32(data) !== header.crc) {
          throw new Error('The backup wallet failed its integrity check.');
        }
        return data;
      },
    }));
  }
  if (bytes.length > MAX_WALLET) throw new Error('Choose a wallet file smaller than 8 MB.');
  return [{ id: '0', name: path.basename(file), read: () => bytes }];
}

function registerWalletImport({ ipcMain, dialog, profiles, allowed, getWindow, rpc, settingsOnly, restart }) {
  const profile = profiles.current;
  let choices = [];
  let verified = null;
  let busy = false;
  const pending = () => !readSetup(profile) || fs.existsSync(path.join(profile.root, 'wallet-setup-requested'));
  const state = () => ({
    pending: pending(),
    hasWallet: fs.existsSync(path.join(profile.wallet, 'wallets', 'default_wallet')),
    profiles: profiles.list(),
    cloudSync: readSetup(profile)?.cloudSync !== false,
  });

  ipcMain.on('wallet-cloud-sync-enabled', (event) => {
    event.returnValue = allowed(event) && readSetup(profile)?.cloudSync !== false;
  });
  ipcMain.handle('wallet-setup', async (event, operation, value) => {
    if (!allowed(event)) throw new Error('Unknown window.');
    if (operation === 'state') return state();
    if (busy) throw new Error('A wallet operation is already in progress.');
    busy = true;
    try {
      if (operation === 'open') {
        if (!fs.existsSync(path.join(profile.root, 'wallet-setup-requested'))) {
          writePrivate(path.join(profile.root, 'wallet-setup-requested'), '1');
        }
        await restart();
        return;
      }
      if (!settingsOnly() || !pending()) throw new Error('Open wallet setup before importing.');
      if (operation === 'choose') {
        verified = null;
        choices = [];
        const result = await dialog.showOpenDialog(getWindow(), {
          title: 'Import a wallet copy',
          properties: ['openFile'],
          filters: [{ name: 'Wallet files and backups', extensions: ['*'] }],
        });
        if (!allowed(event)) throw new Error('Unknown window.');
        if (result.canceled || result.filePaths.length !== 1) return { canceled: true };
        try {
          choices = readSelection(result.filePaths[0]);
        } catch (_) {
          throw new Error('Could not read this wallet or backup ZIP. Check the file and try again.');
        }
        return { choices: choices.map(({ id, name }) => ({ id, name })) };
      }
      if (operation === 'preview') {
        verified = null;
        if (
          !value ||
          typeof value.id !== 'string' ||
          (value.password !== undefined && (typeof value.password !== 'string' || value.password.length > 1024))
        )
          throw new Error('Invalid wallet selection.');
        const choice = choices.find(({ id }) => id === value.id);
        if (!choice) throw new Error('Choose a wallet file first.');
        const directory = ownedDirectory(profile.data, 'wallet-import');
        const name = crypto.randomBytes(16).toString('hex') + '.wallet';
        const file = path.join(directory, name);
        try {
          const bytes = Buffer.from(choice.read());
          writePrivate(file, bytes);
          const preview = await rpc('wallet_import_preview', { file_name: name, password: value.password });
          if (!allowed(event)) throw new Error('Unknown window.');
          if (preview.ok) verified = bytes;
          return preview;
        } finally {
          fs.rmSync(file, { force: true });
        }
      }
      if (operation === 'keep') {
        completeSetup(profile, 'existing', true);
        choices = [];
        verified = null;
        return state();
      }
      if (operation === 'import' || operation === 'fresh' || operation === 'switch') {
        if (!value || value.confirmed !== true) throw new Error('Confirm the wallet and cloud sync notice first.');
        if (operation === 'import' && !verified) throw new Error('Check the selected wallet before importing.');
        const id = operation === 'switch' ? value.id : profiles.prepare(operation === 'import' ? verified : null);
        // Stop the owned SDK before changing which complete profile will be used next launch.
        await restart(() => profiles.activate(id));
        verified = null;
        choices = [];
        return { restarting: true };
      }
      throw new Error('Unknown wallet operation.');
    } finally {
      busy = false;
    }
  });
  return { state, pending };
}

module.exports = { registerWalletImport, readSelection };
