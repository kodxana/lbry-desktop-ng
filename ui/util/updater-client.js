import desktop from 'util/desktop';

export async function requestUpdater(command, value) {
  try {
    return await desktop.updater(command, value);
  } catch (_) {
    return { ok: false, error: 'transport' };
  }
}
