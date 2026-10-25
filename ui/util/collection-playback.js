// @flow
export function findPlayableUrl(
  urls: Array<?string>,
  index: number,
  direction: -1 | 1,
  loop: boolean,
  isPlayable: (string) => boolean
): string | null {
  if (index < 0 || index >= urls.length) return null;
  // One pass also terminates repeated playlists containing only unavailable items.
  for (let offset = 1; offset <= urls.length; offset += 1) {
    const position = index + offset * direction;
    if (!loop && (position < 0 || position >= urls.length)) return null;
    const candidate = urls[((position % urls.length) + urls.length) % urls.length];
    if (candidate && isPlayable(candidate)) return candidate;
  }
  return null;
}
