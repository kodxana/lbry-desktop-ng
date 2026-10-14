import { strict as assert } from 'assert';
import React from 'react';
import AdmZip from 'adm-zip';
import { Buffer } from 'buffer';
import ComicBookViewer from 'component/viewers/comicBookViewer';
import { render, unmount, waitFor } from './helpers';

export default async function comics(store, history) {
  const archive = new AdmZip();
  for (const [name, color] of [
    ['01.png', 'red'],
    ['02.png', 'blue'],
  ]) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d');
    context.fillStyle = color;
    context.fillRect(0, 0, 64, 64);
    archive.addFile(name, Buffer.from(canvas.toDataURL().split(',')[1], 'base64'));
  }
  archive.addFile('notes.txt', Buffer.from('Skip non-image entries'));
  const source = { file: async () => archive.toBuffer() };
  render(<ComicBookViewer source={source} theme="dark" />, store, history);
  document.querySelector('.file-render__viewer--comic').style.height = '500px';
  const page = () => document.querySelector('[aria-label="Go to page number"]');
  await waitFor(() => page(), 'The comic reader must unpack the CBZ using its real worker');
  const painted = (channel) =>
    Array.from(document.querySelectorAll('canvas')).some((canvas) => {
      if (!canvas.width || !canvas.height) return false;
      const pixel = canvas.getContext('2d').getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
      return pixel[channel] > 200 && pixel[2 - channel] < 30 && pixel[3] === 255;
    });
  await waitFor(() => painted(0), 'Comic page one must paint red pixels');
  assert.equal(page().value, '1');
  const next = document.querySelector('button[aria-label="Next page"]');
  assert(next, 'The reader must expose next-page navigation');
  next.click();
  await waitFor(() => page().value === '2' && painted(2), 'Next must paint the blue second page');
  document.querySelector('button[aria-label="Previous page"]').click();
  await waitFor(() => page().value === '1' && painted(0), 'Previous must return to page one');
  assert.equal(document.querySelector('.villain').getAttribute('data-theme'), 'Dark');
  const settings = document.querySelector('button[aria-label="Settings"]');
  settings.click();
  await waitFor(() => settings.getAttribute('aria-expanded') === 'true', 'Comic settings must open');
  const menu = document.querySelector('.villain-menu');
  assert(menu && menu.querySelector('[role="menuitemcheckbox"]'), 'Reader options must render');
  await waitFor(
    () => Number(getComputedStyle(menu.querySelector('.villain-menu__animated-content')).opacity) > 0.99,
    'The settings menu must finish appearing'
  );
  settings.click();
  await waitFor(() => settings.getAttribute('aria-expanded') === 'false', 'Comic settings must dismiss');
  await waitFor(
    () => menu.hidden || getComputedStyle(menu).display === 'none',
    'The menu animation must finish closing'
  );
  unmount();
  assert(!document.querySelector('.comic-viewer'));
  render(
    <ComicBookViewer
      source={{
        file: async () => {
          throw new Error('Missing fixture');
        },
      }}
      theme="dark"
    />,
    store,
    history
  );
  await waitFor(() => document.body.textContent.includes("can't load the archive"), 'Read failures must show an error');
  unmount();
}
