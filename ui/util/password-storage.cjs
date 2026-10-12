// Keep migration separate from the cookie shim: old releases stored cookies in
// __cookieStore__, including host-only and domain/path variants.
function legacyPasswordCookies(storage, domains) {
  const allowed = new Set(['lbry.tv', 'localhost', ...domains].filter(Boolean));
  function entries(remove) {
    const raw = storage.getItem('__cookieStore__');
    if (raw === null) return [];
    const jar = JSON.parse(raw);
    if (!jar || typeof jar !== 'object' || Array.isArray(jar)) throw new Error('Invalid cookie store');
    const passwords = [];
    for (const host of Object.keys(jar)) {
      if (!allowed.has(host.replace(/^\./, ''))) continue;
      for (const cookies of Object.values(jar[host])) {
        const cookie = cookies.saved_password;
        if (!cookie) continue;
        if (typeof cookie.value !== 'string') throw new Error('Invalid saved cookie');
        if (!cookie.expires || cookie.expires === 'Infinity' || Date.parse(cookie.expires) > Date.now()) {
          passwords.push(cookie.value);
        }
        if (remove) delete cookies.saved_password;
      }
    }
    if (remove) storage.setItem('__cookieStore__', JSON.stringify(jar));
    return passwords;
  }
  return { read: () => entries(false), clear: () => entries(true) };
}

function createPasswordClient(invoke, legacy) {
  let session;
  let queue = Promise.resolve();
  let readWarningShown = false;
  const serial = (work) => {
    const result = queue.then(work);
    queue = result.catch(() => {});
    return result;
  };
  const request = async (operation, value) => {
    const result = await invoke(operation, value);
    if (!result || !result.ok) throw new Error('Password storage failed');
    return result;
  };
  const notice = (action) => request('notice', action);
  const clearLegacy = async () => {
    legacy.clear();
    await request('clear-legacy');
  };
  const getSavedPasswordState = () =>
    serial(async () => {
      if (session) return { ...session };
      let fallback = { password: null, remembered: false };
      try {
        const record = await request('read');
        if (record.state === 'saved') {
          fallback = { password: record.password, remembered: true };
          if (!record.pending) await clearLegacy();
        } else if (record.state === 'forgotten') {
          await clearLegacy();
        } else {
          const candidates = [...legacy.read(), ...(await request('legacy')).passwords].filter((value) => value !== '');
          const unique = [...new Set(candidates)];
          if (unique.length > 1) throw new Error('Conflicting saved passwords');
          if (unique.length === 1) {
            fallback = { password: unique[0], remembered: true };
            const migrated = await request('migrate', unique[0]);
            if (!migrated.pending) await clearLegacy();
          } else if (record.state === 'migration-unreadable') {
            throw new Error('Migration needs recovery');
          }
        }
      } catch (_) {
        if (!readWarningShown) {
          readWarningShown = true;
          await notice('read');
        }
      }
      session = fallback;
      return { ...session };
    });
  return {
    getSavedPasswordState,
    hasSavedPassword: () =>
      serial(async () => {
        try {
          return (await request('status')).saved || legacy.read().length > 0;
        } catch (_) {
          // Keep Forget available when a legacy jar or storage metadata is unreadable.
          return true;
        }
      }),
    getSavedPassword: async () => (await getSavedPasswordState()).password,
    setSavedPassword: (value, remember) =>
      serial(async () => {
        const password = value == null ? '' : value;
        session = { password: password || null, remembered: false };
        try {
          const saved = remember && password ? await request('save', password) : await request('forget');
          if (!saved.pending) await clearLegacy();
          session.remembered = Boolean(remember && password);
          return true;
        } catch (_) {
          await notice(remember && password ? 'save' : 'forget');
          return false;
        }
      }),
    deleteSavedPassword: () =>
      serial(async () => {
        session = { password: null, remembered: false };
        try {
          await request('forget');
          await clearLegacy();
          return true;
        } catch (_) {
          await notice('forget');
          return false;
        }
      }),
  };
}

module.exports = { createPasswordClient, legacyPasswordCookies };
