// Fault-injectable boundary for tests; production always uses Electron safeStorage.
const crypto = require('crypto');

module.exports = function passwordBackend() {
  const key = crypto.randomBytes(32);
  return {
    available: true,
    async isAsyncEncryptionAvailable() {
      return this.available;
    },
    async encryptStringAsync(value) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return Buffer.concat([Buffer.from('v11'), iv, cipher.getAuthTag(), data]);
    },
    async decryptStringAsync(value) {
      const cipher = crypto.createDecipheriv('aes-256-gcm', key, value.slice(3, 15));
      cipher.setAuthTag(value.slice(15, 31));
      return {
        result: Buffer.concat([cipher.update(value.slice(31)), cipher.final()]).toString('utf8'),
        shouldReEncrypt: false,
      };
    },
  };
};
