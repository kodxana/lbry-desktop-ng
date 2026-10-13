// @flow
export function getFilePath(file: File): string {
  let path = file.name;
  // @if TARGET='app'
  path = require('electron').webUtils.getPathForFile(file);
  // @endif
  return path;
}
