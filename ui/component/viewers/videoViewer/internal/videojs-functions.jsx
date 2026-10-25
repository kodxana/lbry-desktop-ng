// @flow
export type MediaSource = { src: string, type: string };

// SDK streams may redirect to a transcoded manifest, including signed URLs.
export default async function resolveMediaSource(
  source: string,
  sourceType: string,
  signal?: AbortSignal
): Promise<MediaSource> {
  const response = await fetch(source, { method: 'HEAD', cache: 'no-store', signal });
  const src = response.redirected ? response.url : source;
  const pathname = new URL(src, window.location.href).pathname.toLowerCase();
  const contentType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  const type =
    pathname.endsWith('.m3u8') || /mpegurl/.test(contentType)
      ? 'application/x-mpegURL'
      : pathname.endsWith('.mpd') || contentType === 'application/dash+xml'
        ? 'application/dash+xml'
        : sourceType;
  return { src, type };
}
