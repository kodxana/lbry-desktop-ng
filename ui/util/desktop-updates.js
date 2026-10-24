import source from '../../release-source.json';

export const releasesUrl = `https://github.com/${source.owner}/${source.repo}/releases`;

export function releaseNotesUrl(version) {
  const api = `https://api.github.com/repos/${source.owner}/${source.repo}/releases`;
  if (!version) return `${api}/latest`;
  const tag = 'v' + version.replace(/^v/, '');
  return `${api}/tags/${encodeURIComponent(tag)}`;
}
