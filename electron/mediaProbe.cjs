const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execute = promisify(execFile);

module.exports = async function probe(filename) {
  const { stdout } = await execute(
    process.env.FFPROBE_PATH || 'ffprobe',
    ['-v', 'error', '-print_format', 'json', '-show_format', '-i', filename],
    { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 }
  );
  const { format } = JSON.parse(stdout);
  if (!format || typeof format.format_name !== 'string') throw new Error('Invalid media metadata');
  const duration = format.duration === undefined ? 0 : Number(format.duration);
  if (!Number.isFinite(duration) || duration < 0) throw new Error('Invalid media duration');
  return { format: { format_name: format.format_name, duration } };
};
