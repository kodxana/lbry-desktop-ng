const fs = require('fs');
const { createRendererGuard } = require('./rendererGuard.cjs');

function registerTranslationCollection({ ipcMain, file, getWindow, rendererURL }) {
  const allowed = createRendererGuard(getWindow, rendererURL);
  let messages;
  ipcMain.on('collect-message', (event, message) => {
    if (!allowed(event) || typeof message !== 'string' || message.length > 100000) return;
    if (!messages) messages = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Object.hasOwn(messages, message)) return;
    delete messages['--end--'];
    const begin = message.lastIndexOf('--[');
    messages[message] = begin > 0 && message.endsWith(']--') ? message.substring(0, begin).trimEnd() : message;
    messages['--end--'] = '--end--';
    fs.writeFileSync(file, JSON.stringify(messages, null, 2) + '\n', 'utf8');
  });
}

module.exports = { registerTranslationCollection };
