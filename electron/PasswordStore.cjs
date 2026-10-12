const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');

// Only ciphertext (or a durable opt-out marker) belongs in this file.
class PasswordStore {
  constructor(directory, safeStorage, filesystem = fs, platform = process.platform) {
    this.file = path.join(directory, 'remembered-password.json');
    this.crypto = safeStorage;
    this.fs = filesystem;
    this.platform = platform;
    this.migratedThisRun = false;
  }

  available() {
    if (!this.crypto.isEncryptionAvailable()) throw new Error('unavailable');
    if (
      this.platform === 'linux' &&
      this.crypto.getSelectedStorageBackend &&
      this.crypto.getSelectedStorageBackend() === 'basic_text'
    ) {
      throw new Error('unavailable');
    }
  }

  decode(record) {
    if (!record || record.version !== 1) throw new Error('unreadable');
    if (record.forgotten === true) return { state: 'forgotten' };
    if (typeof record.ciphertext !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(record.ciphertext)) {
      throw new Error('unreadable');
    }
    this.available();
    const bytes = Buffer.from(record.ciphertext, 'base64');
    // Electron 17 has no getSelectedStorageBackend(). Chromium's Linux v10 format
    // uses a hardcoded key; only v11 is backed by the desktop's secret store.
    if (this.platform === 'linux' && bytes.slice(0, 3).toString() !== 'v11') throw new Error('unavailable');
    const value = JSON.parse(this.crypto.decryptString(bytes));
    if (value.kind !== 'lbry-desktop-password' || typeof value.password !== 'string' || !value.password) {
      throw new Error('unreadable');
    }
    return { state: 'saved', password: value.password };
  }

  read() {
    let bytes;
    try {
      bytes = this.fs.readFileSync(this.file, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return { state: 'missing' };
      throw error;
    }
    const record = JSON.parse(bytes);
    let saved;
    try {
      saved = this.decode(record);
    } catch (error) {
      if (record.version === 1 && record.migration === true) return { state: 'migration-unreadable' };
      throw error;
    }
    if (record.migration === true && saved.state === 'saved') {
      if (this.migratedThisRun) return { ...saved, pending: true };
      // A new main process has proved the OS key survives restart. Commit before
      // allowing the renderer to remove the only legacy recovery copy.
      return this.write({ version: 1, ciphertext: record.ciphertext }, saved.password);
    }
    return saved;
  }

  write(record, password) {
    const temporary = this.file + '.' + randomBytes(12).toString('hex') + '.tmp';
    let fd;
    try {
      fd = this.fs.openSync(temporary, 'wx', 0o600);
      this.fs.writeFileSync(fd, JSON.stringify(record) + '\n', 'utf8');
      this.fs.fsyncSync(fd);
      this.fs.closeSync(fd);
      fd = undefined;
      const checked = this.decode(JSON.parse(this.fs.readFileSync(temporary, 'utf8')));
      if (password !== undefined && checked.password !== password) throw new Error('verification');
      if (password === undefined && checked.state !== 'forgotten') throw new Error('verification');
      this.fs.renameSync(temporary, this.file);
      if (this.platform !== 'win32') {
        const directory = this.fs.openSync(path.dirname(this.file), 'r');
        try {
          this.fs.fsyncSync(directory);
        } finally {
          this.fs.closeSync(directory);
        }
      }
      // Do not let the caller remove legacy copies before verifying the final file.
      const saved = this.read();
      if (password !== undefined && saved.password !== password) throw new Error('verification');
      if (password === undefined && saved.state !== 'forgotten') throw new Error('verification');
      return saved;
    } finally {
      if (fd !== undefined) this.fs.closeSync(fd);
      try {
        this.fs.unlinkSync(temporary);
      } catch (error) {
        // A cleanup failure must also keep the caller from deleting recovery cookies.
        if (error.code !== 'ENOENT') throw error; // eslint-disable-line no-unsafe-finally
      }
    }
  }

  save(password, migrate = false) {
    if (typeof password !== 'string' || !password || password.length > 1024 * 1024) throw new Error('invalid');
    this.available();
    if (!migrate && this.migratedThisRun) {
      const saved = this.read();
      if (saved.state === 'saved' && saved.password === password && saved.pending) return saved;
    }
    const ciphertext = this.crypto.encryptString(JSON.stringify({ kind: 'lbry-desktop-password', password }));
    if (migrate) this.migratedThisRun = true;
    return this.write(
      { version: 1, ciphertext: ciphertext.toString('base64'), ...(migrate ? { migration: true } : {}) },
      password
    );
  }

  forget() {
    // Keep this marker: an interrupted cookie cleanup must never resurrect a password.
    const result = this.write({ version: 1, forgotten: true });
    // A process killed during a write can leave an encrypted temporary file.
    for (const name of this.fs.readdirSync(path.dirname(this.file))) {
      if (/^remembered-password\.json\.[a-f0-9]{24}\.tmp$/.test(name)) {
        this.fs.unlinkSync(path.join(path.dirname(this.file), name));
      }
    }
    return result;
  }
}

module.exports = PasswordStore;
