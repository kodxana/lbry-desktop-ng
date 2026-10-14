const path = require('path');
// Updater diagnostics need no renderer IPC or injected preload.
const log = require('electron-log/node');

module.exports = function createUpdaterLogger(directory) {
  const logger = log.create({ logId: 'updater' });
  logger.transports.file.resolvePathFn = () => path.join(directory, 'main.log');
  return logger;
};
