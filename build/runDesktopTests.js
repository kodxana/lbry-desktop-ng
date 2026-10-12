const { spawnSync } = require('child_process');
const path = require('path');

for (const file of ['testDesktopSetup.js', 'testDesktopUpdates.js', 'testPasswordStorage.js']) {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit', timeout: 120000 });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
