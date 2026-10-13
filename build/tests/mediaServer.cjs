const fs = require('fs');
const path = require('path');
const http = require('http');

module.exports = async () => {
  const types = {
    'sample.mp4': 'video/mp4',
    'audio.m4a': 'audio/mp4',
    'playlist.m3u8': 'application/vnd.apple.mpegurl',
    'master.m3u8': 'application/vnd.apple.mpegurl',
    'low.m3u8': 'application/vnd.apple.mpegurl',
    'low-0.ts': 'video/mp2t',
    'low-1.ts': 'video/mp2t',
    'low-2.ts': 'video/mp2t',
    'segment-0.ts': 'video/mp2t',
    'segment-1.ts': 'video/mp2t',
    'segment-2.ts': 'video/mp2t',
  };
  const requests = [];
  const server = http.createServer((request, response) => {
    const name = new URL(request.url, 'http://127.0.0.1').pathname.slice(1);
    requests.push({ name, method: request.method, range: request.headers.range });
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405).end();
      return;
    }
    if (name === 'redirect.mp4') {
      response.writeHead(302, { Location: '/playlist.m3u8' }).end();
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(types, name)) {
      response.writeHead(404).end();
      return;
    }
    const bytes = fs.readFileSync(path.join(__dirname, 'fixtures/media', name));
    response.setHeader('Content-Type', types[name]);
    response.setHeader('Accept-Ranges', 'bytes');
    let start = 0;
    let end = bytes.length - 1;
    if (request.headers.range) {
      const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range);
      start = range ? Number(range[1]) : bytes.length;
      end = range && range[2] ? Math.min(Number(range[2]), end) : end;
      if (start > end) {
        response.writeHead(416, { 'Content-Range': `bytes */${bytes.length}` }).end();
        return;
      }
      response.statusCode = 206;
      response.setHeader('Content-Range', `bytes ${start}-${end}/${bytes.length}`);
    }
    response.setHeader('Content-Length', end - start + 1);
    response.end(request.method === 'HEAD' ? undefined : bytes.subarray(start, end + 1));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    origin: 'http://127.0.0.1:' + server.address().port,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
};
