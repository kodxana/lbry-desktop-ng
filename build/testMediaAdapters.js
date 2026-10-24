/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { promisify } = require('util');
const { load } = require('./testStartup');

function countries() {
  const { COUNTRIES, countryOptions } = load('util/country.js', {
    'country-data-list': require('country-data-list'),
  });
  assert.equal(new Set(COUNTRIES).size, COUNTRIES.length);
  assert.deepEqual([...COUNTRIES], [...COUNTRIES].sort());
  assert(COUNTRIES.includes('United Kingdom'));
  assert(!COUNTRIES.includes('Soviet Union'));
  for (const saved of ['Turkey', 'Viet Nam', 'Russian Federation', 'Ceuta, Mulilla', 'Custom saved country']) {
    assert.equal(countryOptions(saved)[0], saved, 'Saved account values must remain selectable');
    assert.equal(countryOptions(saved).filter((value) => value === saved).length, 1);
  }
  assert.deepEqual([...countryOptions('Poland')], [...COUNTRIES]);
  assert.deepEqual([...countryOptions('')], [...COUNTRIES]);
}

function tracking() {
  let now = 0;
  let time = 0;
  let scrubbing = false;
  const listeners = new Map();
  const emitted = [];
  const emit = (name) => listeners.get(name)?.();
  const player = {
    on: (name, fn) => listeners.set(name, fn),
    off: (name, fn) => {
      assert.equal(listeners.get(name), fn);
      listeners.delete(name);
    },
    trigger: (name, data) => emitted.push([name, JSON.parse(JSON.stringify(data))]),
    currentTime: () => time,
    readyState: () => 2,
    scrubbing: () => scrubbing,
  };
  const install = load(
    'component/viewers/videoViewer/internal/videojs-tracking.js',
    {},
    {
      performance: { now: () => now },
    }
  ).default;
  install.call(player);
  const last = () => emitted[emitted.length - 1];
  emit('loadstart');
  now = 1250;
  emit('loadeddata');
  emit('playing');
  assert.deepEqual(last(), ['tracking:firstplay', { secondsToLoad: 1.25 }]);
  emit('pause');
  emit('playing');
  assert.equal(emitted.length, 1, 'Resuming playback is not another first play');

  emit('waiting');
  time = 1;
  emit('timeupdate');
  assert.equal(emitted.length, 1, 'Initial loading is not rebuffering');
  emit('waiting');
  now += 500;
  emit('waiting');
  emit('timeupdate');
  assert.equal(emitted.length, 1, 'A stall ends only when playback advances');
  now += 750;
  time = 2;
  emit('timeupdate');
  assert.deepEqual(last(), [
    'tracking:buffered',
    {
      currentTime: 2,
      readyState: 2,
      secondsToLoad: 1.25,
      bufferCount: 1,
    },
  ]);
  emit('waiting');
  now += 250;
  time = 3;
  emit('timeupdate');
  assert.equal(last()[1].bufferCount, 2);
  assert.equal(last()[1].secondsToLoad, 0.25);

  time = 4.6;
  emit('seeking');
  assert.deepEqual(last(), ['tracking:seek', { seekCount: 1, seekTo: 5 }]);
  emit('seeking');
  assert.equal(last()[1].seekCount, 2);
  const count = emitted.length;
  emit('waiting');
  emit('pause');
  time++;
  emit('timeupdate');
  assert.equal(emitted.length, count, 'Pausing cancels a pending buffer event');
  scrubbing = true;
  emit('pause');
  scrubbing = false;
  emit('waiting');
  now += 200;
  time++;
  emit('timeupdate');
  assert.equal(emitted.length, count, 'Scrubbing must not count as network buffering');
  emit('waiting');
  now += 125;
  time++;
  emit('timeupdate');
  assert.equal(last()[1].secondsToLoad, 0.125, 'Real stalls resume after the scrub grace period');

  for (const reset of ['ended', 'loadstart']) {
    emit(reset);
    emit('playing');
    assert.deepEqual(last(), ['tracking:firstplay', { secondsToLoad: 0 }]);
    emit('seeking');
    assert.equal(last()[1].seekCount, 1);
    emit('waiting');
    now += 50;
    time++;
    emit('timeupdate');
    assert.equal(last()[1].bufferCount, 1);
  }
  emit('waiting');
  emit('dispose');
  assert.equal(listeners.size, 0, 'Disposal removes every listener, including pending stalls');
  const disposed = emitted.length;
  now += 5000;
  time++;
  for (const name of ['timeupdate', 'playing', 'seeking']) emit(name);
  assert.equal(emitted.length, disposed);

  install.call(player);
  emit('loadeddata');
  emit('playing');
  assert.deepEqual(last(), ['tracking:firstplay', { secondsToLoad: 0 }], 'Late attachment must not report epoch time');
  emit('dispose');
}

async function probing() {
  let response = { stdout: JSON.stringify({ format: { duration: '6.125', format_name: 'mov,mp4' } }) };
  let call;
  const execFile = () => {};
  execFile[promisify.custom] = async (...args) => {
    call = args;
    if (response instanceof Error) throw response;
    return response;
  };
  const context = {
    module: { exports: {} },
    process: { env: { FFPROBE_PATH: '/fixture tools/ffprobe' } },
    require: (name) => {
      if (name === 'node:child_process') return { execFile };
      assert.equal(name, 'node:util');
      return { promisify };
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../electron/mediaProbe.cjs'), 'utf8'), context);
  const probe = context.module.exports;
  const filename = '/chosen/Łódź & $(no-shell) - video.mp4';
  assert.equal((await probe(filename)).format.duration, 6.125);
  assert.equal(call[0], '/fixture tools/ffprobe');
  assert.deepEqual([...call[1]], ['-v', 'error', '-print_format', 'json', '-show_format', '-i', filename]);
  assert.equal(call[2].shell, undefined);
  assert.equal(call[2].windowsHide, true);
  assert.equal(call[2].timeout, 15000);
  assert.equal(call[2].maxBuffer, 1024 * 1024);
  delete context.process.env.FFPROBE_PATH;
  await probe(filename);
  assert.equal(call[0], 'ffprobe');
  response = { stdout: '{"format":{"format_name":"image2"}}' };
  assert.equal((await probe(filename)).format.duration, 0);
  for (const stdout of [
    'invalid',
    'null',
    '{}',
    '{"format":{}}',
    '{"format":{"format_name":"mp4","duration":"N/A"}}',
    '{"format":{"format_name":"mp4","duration":-1}}',
  ]) {
    response = { stdout };
    await assert.rejects(probe(filename));
  }
  for (const code of ['ENOENT', 'ETIMEDOUT', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER']) {
    response = Object.assign(new Error('Fixture process failure'), { code });
    await assert.rejects(probe(filename), (error) => error === response);
  }
  if (process.argv.includes('--native')) {
    const native = require('../electron/mediaProbe.cjs');
    const parent = path.resolve(__dirname, '../dist/media-probe-tests');
    fs.mkdirSync(parent, { recursive: true });
    const directory = fs.mkdtempSync(path.join(parent, 'probe-'));
    const target = path.join(directory, 'Łódź & $(no-shell) video.mp4');
    fs.copyFileSync(path.join(__dirname, 'tests/fixtures/media/sample.mp4'), target);
    const result = await native(target);
    assert.equal(result.format.duration, 6);
    assert(result.format.format_name.includes('mp4'));
    const document = path.join(directory, 'document.txt');
    fs.writeFileSync(document, 'Not a media file');
    await assert.rejects(native(document));
    await assert.rejects(native(path.join(directory, 'missing.mp4')));
    console.log('PASS native FFprobe: MP4 duration, Unicode/literal path, non-media and missing files');
  }
}

(async () => {
  countries();
  tracking();
  await probing();
  console.log('PASS country compatibility, playback timing/lifecycle and bounded media probing');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
