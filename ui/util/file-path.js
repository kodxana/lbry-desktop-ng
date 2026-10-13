// @flow
import desktop from './desktop';
export function getFilePath(file: File): string {
  let path = file.name;
  // @if TARGET='app'
  path = desktop.filePath(file);
  // @endif
  return path;
}
