import desktop from 'util/desktop';

export async function getDesktopInfo(command) {
  const result = await desktop.info(command);
  if (!result || !result.ok) throw new Error('Desktop information unavailable');
  return result;
}
