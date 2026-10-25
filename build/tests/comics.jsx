import { strict as assert } from 'assert';
import React from 'react';
import { flushSync } from 'react-dom';
import AdmZip from 'adm-zip';
import { Buffer } from 'buffer';
import fs from 'fs';
import path from 'path';
import { ipcRenderer } from 'electron';
import { Archive } from 'libarchive.js';
import ComicBookViewer from 'component/viewers/comicBookViewer';
import { readComic } from 'util/comic-archive';
import { render, unmount, waitFor, tick } from './helpers';
import 'scss/third-party.scss';
import 'scss/all.scss';

const control = (label) => document.querySelector('[aria-label="' + label + '"]');
const key = (target, value) =>
  flushSync(() => target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })));
function change(field, value) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, value);
  flushSync(() => field.dispatchEvent(new Event('input', { bubbles: true })));
}
function pixel(x = 0.5) {
  const canvas = document.querySelector('.openseadragon-canvas canvas');
  if (!canvas || !canvas.width) return [];
  return [...canvas.getContext('2d').getImageData(canvas.width * x, canvas.height / 2, 1, 1).data];
}
const painted = (color, x) =>
  pixel(x)
    .slice(0, 3)
    .every((value, index) => Math.abs(value - color[index]) < 5) && pixel(x)[3] === 255;

export default async function comics(store, history) {
  document.documentElement.setAttribute('theme', 'dark');
  document.documentElement.dir = 'ltr';
  const NativeWorker = window.Worker;
  const activeWorkers = new Set();
  let onWorkerStarted;
  const createUrl = URL.createObjectURL;
  const revokeUrl = URL.revokeObjectURL;
  const liveUrls = new Set();
  window.Worker = function (...args) {
    const worker = new NativeWorker(...args);
    const terminate = worker.terminate.bind(worker);
    worker.terminate = () => {
      activeWorkers.delete(worker);
      terminate();
    };
    activeWorkers.add(worker);
    if (onWorkerStarted) onWorkerStarted();
    return worker;
  };
  URL.createObjectURL = (blob) => {
    const url = createUrl.call(URL, blob);
    liveUrls.add(url);
    return url;
  };
  URL.revokeObjectURL = (url) => {
    liveUrls.delete(url);
    return revokeUrl.call(URL, url);
  };
  const archive = new AdmZip();
  const files = [];
  for (const [name, color] of [
    ['Chapter ł/1.png', 'red'],
    ['Chapter ł/2.PNG', 'blue'],
    ['Chapter ł/10.png', 'lime'],
  ]) {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1000;
    const context = canvas.getContext('2d');
    context.fillStyle = color;
    context.fillRect(0, 0, 800, 1000);
    const bytes = Buffer.from(canvas.toDataURL().split(',')[1], 'base64');
    files.push({ file: new File([bytes], name.split('/')[1]), pathname: name });
    archive.addFile(name, bytes);
  }
  archive.addFile('notes.txt', Buffer.from('Skip non-image entries'));
  archive.addFile('__MACOSX/._cover.png', Buffer.from('Skip metadata'));
  const source = { file: async () => archive.toBuffer() };
  const show = (value = source, theme = 'dark') => {
    document.documentElement.setAttribute('theme', theme);
    render(<ComicBookViewer source={value} theme={theme} />, store, history);
    document.querySelector('.file-render__viewer--comic').style.height = '600px';
  };
  const loaded = async () => {
    try {
      await waitFor(
        () => control('Go to page number') && painted([255, 0, 0]),
        'The real archive worker and image viewer must render the red cover'
      );
    } catch (error) {
      throw new Error(
        error.message +
          ': ' +
          document.body.innerText +
          ' ' +
          JSON.stringify({ pixel: pixel(), workers: activeWorkers.size, urls: liveUrls.size })
      );
    }
  };
  try {
    show();
    await loaded();
    for (const name of ['Fit pages', 'Book view', 'Reader settings', 'Fullscreen']) {
      assert(control(name).querySelector('svg'), name + ' must have a visible control icon');
    }
    assert.equal(activeWorkers.size, 0, 'Extraction must terminate its worker');
    assert.equal(liveUrls.size, 3);
    assert.equal(control('Go to page number').max, '3');
    assert(control('Previous page').disabled);
    control('Next page').click();
    await waitFor(() => control('Go to page number').value === '2' && painted([0, 0, 255]), 'Next must paint blue');
    control('Book view').click();
    await waitFor(
      () => painted([0, 0, 255], 0.3) && painted([0, 255, 0], 0.7),
      'Book view must show ordered blue/green pages'
    );
    control('Reader settings').click();
    await waitFor(
      () => control('Reader settings').getAttribute('aria-expanded') === 'true',
      'Reader settings must open'
    );
    const option = (name) =>
      [...document.querySelectorAll('[role="menuitemcheckbox"]')].find((item) => item.textContent === name);
    option('Manga mode').click();
    await waitFor(() => painted([0, 255, 0], 0.3) && painted([0, 0, 255], 0.7), 'Manga mode must reverse the spread');
    if (control('Reader settings').getAttribute('aria-expanded') !== 'true') control('Reader settings').click();
    option('Pin toolbar').click();
    await waitFor(() => document.querySelector('.comic-viewer--unpinned'), 'Unpinning must release the toolbar');
    if (control('Reader settings').getAttribute('aria-expanded') !== 'true') control('Reader settings').click();
    option('Pin toolbar').click();
    await waitFor(() => !document.querySelector('.comic-viewer--unpinned'), 'Pinning must restore the toolbar');
    if (control('Reader settings').getAttribute('aria-expanded') === 'true') key(document.activeElement, 'Escape');
    await waitFor(() => control('Reader settings').getAttribute('aria-expanded') === 'false', 'Escape closes settings');
    await ipcRenderer.invoke('fixture-comic-capture', 'dark');
    control('Page view').click();
    await waitFor(() => painted([0, 0, 255]), 'Single-page mode restores the current page');
    control('Go to page number').focus();
    key(control('Go to page number'), 'ArrowLeft');
    assert.equal(control('Go to page number').value, '2', 'Input editing must not navigate');
    key(document.body, 'ArrowLeft');
    await waitFor(
      () => control('Go to page number').value === '3' && painted([0, 255, 0]),
      'Manga left arrow advances'
    );
    assert(control('Next page').disabled);
    for (const invalid of ['0', '4', '1.5', '']) {
      change(control('Go to page number'), invalid);
      key(control('Go to page number'), 'Enter');
      assert.equal(control('Go to page number').value, '3', 'Invalid jump must preserve the current page');
    }
    change(control('Go to page number'), '1');
    key(control('Go to page number'), 'Enter');
    await loaded();
    control('Zoom in').click();
    await waitFor(() => Number(control('Zoom to percentage value').value) > 100, 'Zoom in must change the viewport');
    control('Fit pages').click();
    await waitFor(() => control('Zoom to percentage value').value === '100', 'Fit resets zoom');
    change(control('Zoom to percentage value'), '150');
    key(control('Zoom to percentage value'), 'Enter');
    await waitFor(() => control('Zoom to percentage value').value === '150', 'Numeric zoom must work');
    control('Zoom out').click();
    await waitFor(() => Number(control('Zoom to percentage value').value) < 150, 'Zoom out must work');
    change(control('Comic page'), '2');
    await waitFor(() => painted([0, 0, 255]), 'Page slider navigates');
    show(source, 'light');
    await waitFor(
      () => document.querySelector('.comic-viewer').dataset.theme === 'light',
      'Reader follows the app theme'
    );
    await ipcRenderer.invoke('fixture-comic-capture', 'light');

    await ipcRenderer.invoke('fixture-comic-fullscreen', 'Fullscreen');
    await waitFor(
      () => document.fullscreenElement === document.querySelector('.comic-viewer'),
      'Native fullscreen must enter the reader'
    );
    control('Reader settings').click();
    await waitFor(
      () => control('Reader settings').getAttribute('aria-expanded') === 'true',
      'Settings must remain accessible inside fullscreen'
    );
    assert(document.fullscreenElement.contains(document.querySelector('[role="menu"]')));
    key(document.activeElement, 'Escape');
    await ipcRenderer.invoke('fixture-comic-fullscreen', 'Exit fullscreen');
    await waitFor(() => !document.fullscreenElement && control('Fullscreen'), 'Native fullscreen must exit');

    // Also exercise platforms that deny fullscreen.
    const request = Element.prototype.requestFullscreen;
    let requests = 0;
    Element.prototype.requestFullscreen = async function () {
      requests++;
      throw new Error('Denied by fixture');
    };
    try {
      control('Fullscreen').click();
      await waitFor(
        () => document.body.textContent.includes('Fullscreen is unavailable'),
        'Denied fullscreen remains usable'
      );
      assert.equal(requests, 1);
    } finally {
      Element.prototype.requestFullscreen = request;
    }
    unmount();
    assert.equal(liveUrls.size, 0, 'Closing a comic revokes every page URL');
    assert.equal(activeWorkers.size, 0);

    // Independent Python tarfile and 7-Zip fixtures exercise the real WASM decoder.
    const fixturePath = path.resolve('build/tests/fixtures/comics');
    for (const name of ['pages.tar', 'pages.7z']) {
      show({ file: async () => fs.readFileSync(path.join(fixturePath, name)) });
      await loaded();
      unmount();
      assert.equal(liveUrls.size, 0);
      assert.equal(activeWorkers.size, 0);
    }
    for (const name of ['test-v4.rar', 'test-v5.rar']) {
      Archive.init({ workerUrl: 'webworkers/worker-bundle.js' });
      const rar = await Archive.open(new File([fs.readFileSync(path.join(fixturePath, name))], name));
      try {
        const hashes = {};
        for (const { file, path: directory } of await rar.getFilesArray()) {
          const bytes = await (await file.extract()).arrayBuffer();
          hashes[directory + file.name] = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
        }
        assert.deepEqual(
          hashes,
          {
            '.gitignore': 'd1e8d4fa856e17b2ad54a216aae527a880873df76cc30a85d6ba6b32d2ee23cc',
            'addon/addon.py': 'e0ab20fe5fd7ab5c2b38511d81d93b9cb6246e300d0893face50e8a5b9485b90',
            'addon/addon.xml': 'd26a8bdf02e7ab2eaeadf2ab603a1d11b2a5bfe57a6ac672d1a1c4940958eba8',
            'README.md': 'b4555fd8dd6e81599625c1232e58d5e09fc36f3f6614bf792a6978b30cfe65bb',
          },
          name + ' contents must match the independent upstream fixture checksums'
        );
      } finally {
        await rar.close();
      }
    }
    await assert.rejects(
      readComic(fs.readFileSync(path.join(fixturePath, 'encrypted.zip')), new AbortController().signal),
      /Password-protected/
    );
    for (const [name, zip] of [
      ['empty', new AdmZip()],
      [
        'unsafe path',
        (() => {
          const zip = new AdmZip();
          zip.addFile('__proto__/comicFixture.png', Buffer.from('unsafe'));
          return zip;
        })(),
      ],
      [
        'too many pages',
        (() => {
          const zip = new AdmZip();
          for (let i = 0; i < 501; i++) zip.addFile(i + '.png', Buffer.from('x'));
          return zip;
        })(),
      ],
      [
        'file/directory collision',
        (() => {
          const zip = new AdmZip();
          zip.addFile('1.png', Buffer.from('x'));
          zip.addFile('1.png/2.png', Buffer.from('x'));
          return zip;
        })(),
      ],
      [
        'oversized page',
        (() => {
          const zip = new AdmZip();
          zip.addFile('1.png', Buffer.alloc(32 * 1024 * 1024 + 1));
          return zip;
        })(),
      ],
    ]) {
      await assert.rejects(readComic(zip.toBuffer(), new AbortController().signal), undefined, name);
      assert.equal(Object.prototype.comicFixture, undefined);
      assert.equal(Object.prototype['comicFixture.png'], undefined);
      assert.equal(activeWorkers.size, 0);
      assert.equal(liveUrls.size, 0);
    }
    const trackedWorker = window.Worker;
    const realTimeout = window.setTimeout;
    try {
      for (const fail of [false, true]) {
        window.Worker = function () {
          const worker = new EventTarget();
          worker.postMessage = () => {
            if (fail) queueMicrotask(() => worker.dispatchEvent(new Event('error', { cancelable: true })));
          };
          worker.terminate = () => activeWorkers.delete(worker);
          activeWorkers.add(worker);
          return worker;
        };
        window.setTimeout = (callback, delay, ...args) => realTimeout(callback, delay === 30000 ? 20 : delay, ...args);
        await assert.rejects(
          readComic(archive.toBuffer(), new AbortController().signal),
          fail ? /could not start/ : /too long/
        );
        assert.equal(activeWorkers.size, 0, 'Failed or stalled workers must terminate');
      }
    } finally {
      window.Worker = trackedWorker;
      window.setTimeout = realTimeout;
    }
    for (const file of [
      async () => Buffer.from('Corrupt archive'),
      async () => {
        throw new Error('Missing fixture');
      },
    ]) {
      show({ file });
      await waitFor(
        () => document.body.textContent.includes("can't load the archive"),
        'Archive failures must show an error'
      );
      unmount();
      assert.equal(activeWorkers.size, 0);
    }
    const corrupt = new AdmZip();
    corrupt.addFile('1.png', Buffer.from('Not an image'));
    corrupt.addFile('2.png', await files[0].file.arrayBuffer().then((bytes) => Buffer.from(bytes)));
    show({ file: async () => corrupt.toBuffer() });
    await waitFor(
      () => document.body.textContent.includes('page could not be displayed'),
      'Bad image shows a recoverable error'
    );
    control('Next page').click();
    await loaded();
    assert(!document.querySelector('.comic-viewer__error'));
    unmount();

    let finishOld;
    show({
      file: () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    });
    show();
    await loaded();
    finishOld(Buffer.from('Stale read'));
    await tick();
    assert(control('Go to page number'), 'A stale file read cannot replace the current comic');
    unmount();
    const starting = new Promise((resolve) => {
      onWorkerStarted = resolve;
    });
    show();
    // Cancel on worker creation; polling can miss an archive that finishes between polls.
    await starting;
    onWorkerStarted = null;
    assert.equal(activeWorkers.size, 1, 'Extraction must start before cancellation');
    unmount();
    await waitFor(
      () => activeWorkers.size === 0 && liveUrls.size === 0,
      'Cancellation terminates the worker and revokes pages'
    );
    assert(!document.querySelector('.comic-viewer'));
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    assert(!event.defaultPrevented, 'Closing the reader removes global keyboard handlers');
    return 'Comic ZIP/TAR/7z pixels, RAR 4/5 bytes, manga/book modes, keyboard/slider/zoom, themes, fullscreen, archive failures and worker/URL cleanup';
  } catch (error) {
    await ipcRenderer.invoke('fixture-comic-capture', 'failure');
    throw error;
  } finally {
    unmount();
    for (const worker of activeWorkers) worker.terminate();
    for (const url of liveUrls) revokeUrl.call(URL, url);
    window.Worker = NativeWorker;
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = revokeUrl;
  }
}
