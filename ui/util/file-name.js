import path from 'path-browserify';
import desktop from './desktop';

// These operations only parse names; they do not access the filesystem.
const separators = (value) => (desktop.platform === 'win32' ? value.replace(/\\/g, '/') : value);
export default {
  parse: (value) => path.parse(separators(value)),
  extname: (value) => path.extname(separators(value)),
  basename: (value) => path.basename(separators(value)),
};
