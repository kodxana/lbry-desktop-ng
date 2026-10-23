import { strict as assert } from 'assert';
import React from 'react';
import sharedUi from './sharedUi';
import ReactModal from 'react-modal';
import jsQR from 'jsqr';
import imagesLoaded from 'imagesloaded';
import WalletAddress from 'component/walletAddress/view';
import Paginate from 'component/common/paginate';
import FileRenderFloating from 'component/fileRenderFloating/view';
import FreezeframeLite from 'component/fileThumbnail/FreezeframeLite';
import { Modal } from 'modal/modal';
import Downloading from 'modal/modalDownloading/view';
import imageUrl from './fixtures/build-probe.svg';
import * as ACTIONS from 'constants/action_types';
import { render, unmount, tick, waitFor, input, submit } from './helpers';

const button = (label) => Array.from(document.querySelectorAll('button')).find((node) => node.textContent === label);
const mouse = (node, type, x, y) =>
  node.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: type === 'mouseup' ? 0 : 1,
    })
  );

async function walletQR(store, history) {
  const addresses = ['b' + '1'.repeat(33), 'b' + '2'.repeat(33)];
  let checked;
  let requests = 0;
  const show = (receiveAddress, gettingNewAddress = false) =>
    render(
      <WalletAddress
        receiveAddress={receiveAddress}
        gettingNewAddress={gettingNewAddress}
        checkAddressIsMine={(address) => {
          checked = address;
        }}
        getNewAddress={() => requests++}
      />,
      store,
      history
    );
  const decoded = () => {
    const canvas = document.querySelector('.qr-code canvas');
    assert(canvas, 'Wallet must render a QR canvas');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(pixels.data, pixels.width, pixels.height);
    assert(result, 'An independent decoder must read the rendered QR pixels');
    return result.data;
  };
  show(addresses[0]);
  assert.equal(checked, addresses[0]);
  assert(!document.querySelector('canvas'));
  button('Show QR code').click();
  await tick();
  assert.equal(decoded(), addresses[0]);
  button('Get New Address').click();
  assert.equal(requests, 1);
  show(addresses[0], true);
  assert(button('Get New Address').disabled);
  show(addresses[1]);
  await tick();
  assert.equal(decoded(), addresses[1], 'An address change must redraw the QR without retaining the previous address');
  assert(document.querySelector('.qr-code').classList.contains('qr-code--top-padding'));
  button('Hide QR code').click();
  await waitFor(() => !document.querySelector('.qr-code'), 'Hide must remove the QR code');
  unmount();
  show(undefined, true);
  button('Show QR code').click();
  assert(!document.querySelector('.qr-code canvas'), 'An address still loading must not produce an invalid QR');
  unmount();
}

async function pagination(store, history) {
  const pages = [];
  const onPageChange = (page) => pages.push(page);
  history.replace('/widgets?tag=keep&page=3');
  render(<Paginate totalPages={10} onPageChange={onPageChange} />, store, history);
  await tick();
  assert.deepEqual(pages, [3], 'Mount must fetch the URL-selected page exactly once');
  const selected = () => document.querySelector('.pagination__item--selected a').textContent;
  assert.equal(selected(), '3');
  document.querySelector('.pagination__item--next a').click();
  await tick();
  assert.deepEqual(pages, [3, 4]);
  assert.equal(new URLSearchParams(history.location.search).get('tag'), 'keep');
  assert.equal(new URLSearchParams(history.location.search).get('page'), '4');
  history.goBack();
  await waitFor(() => selected() === '3', 'Back navigation must restore selection');
  history.push('/widgets?tag=keep');
  await waitFor(() => selected() === '1', 'A URL without page must restore page one');
  const before = pages.length;
  document.querySelector('.pagination__item--previous a').click();
  await tick();
  assert.equal(pages.length, before, 'Disabled previous must not request a page');
  input('paginate-file', '1.5');
  submit();
  assert.equal(pages.length, before, 'Fractional page numbers are invalid');
  input('paginate-file', '10');
  submit();
  await waitFor(() => selected() === '10', 'Go-to must select the requested page');
  const last = pages.length;
  document.querySelector('.pagination__item--next a').click();
  assert.equal(pages.length, last, 'Disabled next must not request a page');
  unmount();

  pages.length = 0;
  const location = history.location;
  render(<Paginate totalPages={3} disableHistory onPageChange={onPageChange} />, store, history);
  await tick();
  document.querySelector('.pagination__item--next a').click();
  await tick();
  assert.deepEqual(pages, [1, 2]);
  assert.equal(history.location, location, 'History-disabled pagination must not change the route');
  unmount();
  pages.length = 0;
  history.replace('/widgets');
  render(<Paginate totalPages={0} onPageChange={onPageChange} />, store, history);
  await tick();
  assert.deepEqual(pages, [1], 'Loading/empty lists still require their initial fetch');
  assert.equal(document.querySelector('form').style.display, 'none');
  unmount();
}

async function dialogs(store, history) {
  const app = document.getElementById('app');
  ReactModal.setAppElement(app);
  const trigger = document.createElement('button');
  trigger.textContent = 'Open fixture dialog';
  document.body.appendChild(trigger);
  let opened = 0;
  let closed = 0;
  let cancelled = 0;
  let confirmed = 0;
  function Prompt() {
    const [open, setOpen] = React.useState(true);
    return (
      <Modal
        isOpen={open}
        type="confirm"
        contentLabel="Fixture confirmation"
        onAfterOpen={({ overlayEl, contentEl }) => {
          assert(overlayEl instanceof HTMLDivElement);
          assert(contentEl instanceof HTMLDivElement);
          opened++;
        }}
        onAfterClose={() => {
          closed++;
        }}
        onAborted={(event) => {
          assert(event.nativeEvent instanceof MouseEvent || event.nativeEvent instanceof KeyboardEvent);
          assert.equal(typeof event.preventDefault, 'function');
          assert.equal(typeof event.stopPropagation, 'function');
          cancelled++;
          setOpen(false);
        }}
        onConfirmed={() => {
          confirmed++;
          setOpen(false);
        }}
      />
    );
  }
  const open = async () => {
    trigger.focus();
    const nextOpen = opened + 1;
    render(<Prompt />, store, history);
    await waitFor(() => opened === nextOpen, 'Dialog must finish opening');
    assert.equal(app.getAttribute('aria-hidden'), 'true');
  };
  await open();
  const dialog = document.querySelector('[role="dialog"]');
  assert.equal(dialog.getAttribute('aria-label'), 'Fixture confirmation');
  const controls = dialog.querySelectorAll('button');
  const key = (code, shiftKey = false) =>
    document.activeElement.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: code,
        code,
        keyCode: code === 'Tab' ? 9 : 27,
        bubbles: true,
        cancelable: true,
        shiftKey,
      })
    );
  controls[controls.length - 1].focus();
  key('Tab');
  assert.equal(document.activeElement, controls[0], 'Tab must wrap within the dialog');
  key('Tab', true);
  assert.equal(document.activeElement, controls[controls.length - 1], 'Shift+Tab must wrap backwards');
  key('Escape');
  await waitFor(() => !document.querySelector('[role="dialog"]'), 'Escape must dismiss');
  assert.equal(cancelled, 1);
  assert.equal(confirmed, 0, 'Escape must not confirm');
  assert.equal(document.activeElement, trigger, 'Closing must restore focus');
  assert.equal(app.getAttribute('aria-hidden'), null);
  unmount();
  await open();
  document.querySelector('.modal-overlay').click();
  await tick();
  assert.equal(cancelled, 2);
  unmount();
  await open();
  button('OK').click();
  await tick();
  assert.equal(confirmed, 1);
  unmount();
  assert.equal(opened, 3);
  assert.equal(closed, 3);
  assert(!document.body.classList.contains('ReactModal__Body--open'));
  trigger.remove();
}

async function progress(store, history) {
  let started = 0;
  let cancelled = 0;
  const show = (downloadProgress, downloadComplete = false, upgradeInitialized = false) =>
    render(
      <Downloading
        downloadProgress={downloadProgress}
        downloadComplete={downloadComplete}
        upgradeInitialized={upgradeInitialized}
        startUpgrade={() => started++}
        cancelUpgrade={() => cancelled++}
      />,
      store,
      history
    );
  const length = () => parseFloat(document.querySelector('.rc-progress-line-path').style.strokeDasharray);
  show(0);
  const empty = length();
  assert(!button('Begin Upgrade'));
  show(42.5);
  const partial = length();
  assert(document.body.textContent.includes('42.5% complete'));
  show(100, true);
  assert(empty === 0 && partial > empty && length() > partial, 'Progress geometry must follow download progress');
  button('Begin Upgrade').click();
  assert.equal(started, 1);
  show(100, true, true);
  assert(button('Installing, please wait...').disabled && button('Cancel').disabled);
  show(42.5);
  button('Cancel').click();
  assert.equal(cancelled, 1);
  unmount();
}

async function dragging(store, history) {
  store.dispatch({
    type: ACTIONS.RESOLVE_URIS_COMPLETED,
    data: { resolveInfo: { 'lbry://fixture#abc': { stream: null, channel: null } } },
  });
  const key = 'floating-file-viewer:position';
  localStorage.setItem(key, JSON.stringify({ x: 20, y: 30 }));
  let closed = 0;
  const show = (isFloating = true) =>
    render(
      <div style={{ position: 'relative', width: 800, height: 500 }}>
        <FileRenderFloating
          isFloating={isFloating}
          uri="lbry://fixture#abc"
          renderMode="video"
          floatingPlayerEnabled
          title="Fixture video"
          playingUri={{ uri: 'lbry://fixture#abc' }}
          closeFloatingPlayer={() => closed++}
          doFetchRecommendedContent={() => {}}
        />
      </div>,
      store,
      history
    );
  const style = document.createElement('style');
  style.textContent = '.content__viewer { position: absolute; left: 0; top: 0; width: 160px; height: 120px; }';
  document.head.appendChild(style);
  show();
  await tick();
  const target = document.querySelector('.content__viewer');
  assert(target, 'Floating player must render');
  const translation = () => {
    const matrix = new DOMMatrix(getComputedStyle(document.querySelector('.content__viewer')).transform);
    return { x: matrix.e, y: matrix.f };
  };
  const drag = async (handle, dx, dy) => {
    const rect = handle.getBoundingClientRect();
    const x = rect.left + 5;
    const y = rect.top + 5;
    mouse(handle, 'mousedown', x, y);
    await tick();
    mouse(document, 'mousemove', x + dx, y + dy);
    await tick();
    mouse(document, 'mouseup', x + dx, y + dy);
    await tick();
  };
  await drag(target.querySelector('.draggable'), 40, 25);
  const position = JSON.parse(localStorage.getItem(key));
  assert.deepEqual(position, { x: 60, y: 55 }, 'Dragging must save the final position');
  await drag(target.querySelector('button'), 50, 50);
  assert.deepEqual(JSON.parse(localStorage.getItem(key)), position, 'Buttons must not start a drag');
  unmount();
  show();
  await tick();
  assert.deepEqual(translation(), position, 'Remount must restore position');
  document.querySelector('.content__floating-close').click();
  assert.equal(closed, 1);
  show(false);
  await tick();
  assert.deepEqual(translation(), { x: 0, y: 0 });
  unmount();
  mouse(document, 'mousemove', 100, 100);
  assert.deepEqual(JSON.parse(localStorage.getItem(key)), position, 'Unmount must remove drag listeners');
  style.remove();
  localStorage.removeItem(key);
}

async function imageLoading() {
  const holder = document.createElement('div');
  document.body.appendChild(holder);
  const image = new Image(16, 16);
  holder.appendChild(image);
  image.src = imageUrl;
  const freeze = new FreezeframeLite(image);
  await waitFor(() => holder.querySelector('.ff-canvas-ready'), 'Loaded thumbnails must produce their still frame');
  holder.querySelector('canvas').dispatchEvent(new Event('transitionend'));
  await waitFor(() => holder.querySelector('.ff-ready'), 'Thumbnail must finish initialization');
  freeze.toggleOn(freeze.items[0]);
  assert(holder.querySelector('.ff-active'));
  freeze.toggleOff(freeze.items[0]);
  assert(holder.querySelector('.ff-inactive'));
  assert.equal(holder.querySelector('canvas').width, 16);
  const broken = new Image();
  holder.appendChild(broken);
  broken.src = 'data:image/png;base64,bm90IGFuIGltYWdl';
  const failed = new FreezeframeLite(broken);
  const loaded = await new Promise((resolve) => imagesLoaded(broken).on('always', resolve));
  assert(loaded.hasAnyBroken, 'Image loader must report decode failures');
  await tick();
  assert.equal(failed.items.length, 0, 'A broken thumbnail must not be drawn into a canvas');
  holder.remove();
}

export default async function uiComponents(store, history) {
  sharedUi(store, history);
  await walletQR(store, history);
  await pagination(store, history);
  await dialogs(store, history);
  await progress(store, history);
  await dragging(store, history);
  await imageLoading();
  return 'shared icons/ref forwarding and sticker data, wallet QR pixel decoding/address changes, pagination, modal focus/dismissal, update progress, floating drag persistence and thumbnail success/failure';
}
