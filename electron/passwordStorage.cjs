const PasswordStore = require('./PasswordStore.cjs');

const CHANNEL = 'remembered-password';
const normalize = (value) => {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  return url.href;
};

function registerPasswordStorage({
  ipcMain,
  safeStorage,
  directory,
  getWindow,
  rendererURL,
  cookies,
  dialog,
  domains,
}) {
  const store = new PasswordStore(directory, safeStorage);
  const allowedDomains = new Set(['lbry.tv', 'localhost', ...domains].filter(Boolean));
  const legacyCookies = async () =>
    (await cookies.get({ name: 'saved_password' })).filter((cookie) =>
      allowedDomains.has(cookie.domain.replace(/^\./, ''))
    );
  let queue = Promise.resolve();
  ipcMain.handle(CHANNEL, (event, operation, value) => {
    const window = getWindow();
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      normalize(event.senderFrame.url) !== normalize(rendererURL)
    ) {
      return { ok: false, error: 'sender' };
    }
    const run = async () => {
      try {
        switch (operation) {
          case 'status':
            return { ok: true, saved: store.hasSavedPassword() || (await legacyCookies()).length > 0 };
          case 'read':
            return { ok: true, ...store.read() };
          case 'save':
            return { ok: true, pending: Boolean(store.save(value).pending) };
          case 'migrate':
            return { ok: true, pending: Boolean(store.save(value, true).pending) };
          case 'forget':
            store.forget();
            return { ok: true };
          case 'legacy':
            return { ok: true, passwords: (await legacyCookies()).map((cookie) => cookie.value) };
          case 'clear-legacy':
            for (const cookie of await legacyCookies()) {
              await cookies.remove(
                `${cookie.secure ? 'https' : 'http'}://${cookie.domain.replace(/^\./, '')}${cookie.path}`,
                cookie.name
              );
            }
            await cookies.flushStore();
            if ((await legacyCookies()).length) throw new Error('cleanup');
            return { ok: true };
          case 'notice': {
            const details = {
              read: 'LBRY could not read or migrate your remembered password. Any existing saved copy has been kept. You can enter your password manually. Unlock your operating system keyring and try again to use protected storage.',
              save: 'LBRY could not finish saving your password securely. Your successful wallet operation is unchanged, and your password is available for this session. An older saved copy may still be present. You may need to enter your password next time.',
              forget:
                'LBRY could not finish removing the saved password. Please try Forget again. Do not assume the old saved copy has been removed.',
            };
            if (!details[value]) throw new Error('invalid');
            await dialog.showMessageBox(window, {
              type: 'warning',
              title: 'Remember Password',
              message: 'Password storage needs attention',
              detail: details[value],
              buttons: ['OK'],
              noLink: true,
            });
            return { ok: true };
          }
          default:
            return { ok: false, error: 'invalid' };
        }
      } catch (error) {
        // OS and filesystem errors can contain sensitive input; never forward or log them.
        return { ok: false, error: 'storage' };
      }
    };
    const result = queue.then(run);
    queue = result.catch(() => {});
    return result;
  });
  return store;
}

module.exports = { CHANNEL, registerPasswordStorage };
