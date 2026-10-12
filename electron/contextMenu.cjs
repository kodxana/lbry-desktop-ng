const { createRendererGuard } = require('./rendererGuard.cjs');

function validRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return false;
  const { kind, x, y } = request;
  if (!['text', 'editor', 'snippet', 'claim'].includes(kind)) return false;
  if (![x, y].every((value) => Number.isSafeInteger(value) && value >= 0 && value <= 1000000)) return false;
  const flags = kind === 'claim' ? ['hasClaim'] : ['hasText', 'hasSelection', ...(kind === 'text' ? ['editable'] : [])];
  return (
    flags.every((key) => typeof request[key] === 'boolean') &&
    Object.keys(request).every((key) => ['kind', 'x', 'y', ...flags].includes(key))
  );
}

function registerContextMenu({ ipcMain, Menu, clipboard, getWindow, rendererURL, isDev }) {
  const allowed = createRendererGuard(getWindow, rendererURL);
  let pending = false;
  ipcMain.handle('context-menu', (event, request) => {
    const window = getWindow();
    if (!allowed(event, window)) return { ok: false, error: 'sender' };
    if (!validRequest(request)) return { ok: false, error: 'invalid' };
    if (pending) return { ok: false, error: 'busy' };
    pending = true;
    return new Promise((resolve) => {
      const contents = window.webContents;
      let menu;
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        pending = false;
        contents.removeListener('did-start-navigation', navigating);
        contents.removeListener('destroyed', cancel);
        resolve(allowed(event, window) ? result : { ok: false, error: 'sender' });
      };
      const cancel = () => {
        finish({ ok: false, error: 'sender' });
        if (menu) menu.closePopup();
      };
      const navigating = (_event, _url, _inPlace, mainFrame) => {
        if (mainFrame) cancel();
      };
      const item = (id, label, accelerator, enabled = true, command) => ({
        id,
        label,
        accelerator,
        enabled,
        click: () => {
          if (settled || !enabled) return;
          if (!allowed(event, window)) return cancel();
          try {
            if (command) command();
            finish({ ok: true, action: command ? null : id });
          } catch (_) {
            finish({ ok: false, error: 'menu' });
          }
        },
      });
      try {
        const { kind, hasText, hasSelection } = request;
        const template = [];
        if (kind === 'claim') {
          if (request.hasClaim) {
            template.push(item('copy-link', 'Copy link'), { type: 'separator' }, item('report', 'Report content'));
          }
        } else {
          const editor = kind === 'editor' || kind === 'snippet';
          const editable = kind === 'editor' || (kind === 'text' && request.editable);
          if (editor) template.push(item('editor-select-all', 'Select All', 'CmdOrCtrl+A', hasText));
          template.push(item('copy', 'Copy', 'CmdOrCtrl+C', hasSelection, () => contents.copy()));
          if (editable && hasSelection) template.push(item('cut', 'Cut', 'CmdOrCtrl+X', true, () => contents.cut()));
          if (editable && clipboard.readText().length > 0) {
            template.push(item('paste', 'Paste', 'CmdOrCtrl+V', true, () => contents.paste()));
          }
          if (!editor && hasText) {
            template.push(item('select-all', 'Select All', 'CmdOrCtrl+A', true, () => contents.selectAll()));
          }
        }
        if (isDev) {
          if (template.length) template.push({ type: 'separator' });
          template.push(
            item('inspect', 'Inspect element', 'CmdOrCtrl+Shift+I', true, () =>
              contents.inspectElement(request.x, request.y)
            )
          );
        }
        if (!template.length) return finish({ ok: true, action: null });
        menu = Menu.buildFromTemplate(template);
        contents.on('did-start-navigation', navigating);
        contents.once('destroyed', cancel);
        menu.popup({
          window,
          // Let a selected item's click run before resolving a dismissed menu.
          callback: () => setImmediate(() => finish({ ok: true, action: null })),
        });
      } catch (_) {
        finish({ ok: false, error: 'menu' });
      }
    });
  });
}

module.exports = { registerContextMenu };
