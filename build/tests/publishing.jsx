import { strict as assert } from 'assert';
import React from 'react';
import fs from 'fs';
import path from 'path';
import desktop from 'util/desktop';
import PublishFile from 'component/publishFile/view';
import PublishPrice from 'component/publishPrice/view';
import LicenseType from 'component/publishAdditionalOptions/license-type';
import ModalPublishPreview from 'modal/modalPublishPreview/view';
import ModalAutoGenerateThumbnail from 'modal/modalAutoGenerateThumbnail/view';
import { CC_LICENSES, OTHER, NONE } from 'constants/licenses';
import * as PUBLISH_MODES from 'constants/publish_types';
import { render, unmount, waitFor, tick, input } from './helpers';

const button = (label) => Array.from(document.querySelectorAll('button')).find((item) => item.textContent === label);

export default async function publishing(store, history, root) {
  const prices = [];
  render(
    <PublishPrice
      contentIsFree={false}
      fee={{ amount: '0.00000001', currency: 'LBC' }}
      updatePublishForm={(value) => prices.push(value)}
    />,
    store,
    history
  );
  assert.equal(Number(document.getElementById('content_cost_amount_amount').value), 0.00000001);
  input('content_cost_amount_amount', '1.00000001');
  assert.deepEqual(prices.at(-1), { fee: { amount: 1.00000001, currency: 'LBC' } });
  document.getElementById('content_free').click();
  await tick();
  assert.deepEqual(prices.at(-1), { contentIsFree: true });
  unmount();
  const published = [];
  let closed = 0;
  const filePath = path.join(root, 'nested', 'video ł #1.mp4');
  const preview = {
    filePath,
    title: 'Preview title',
    description: 'Preview **description**',
    tags: [{ name: 'test' }],
    licenseType: NONE,
    fee: { amount: '1.00000001', currency: 'LBC' },
    contentIsFree: false,
    bid: 0.01,
    language: 'pl',
    publishing: false,
    previewResponse: { total_fee: '0.001' },
    publish: (...args) => published.push(args),
    closeModal: () => closed++,
    enablePublishPreview: true,
    setEnablePublishPreview: () => {},
  };
  render(<ModalPublishPreview {...preview} />, store, history);
  assert(document.body.textContent.includes(path.basename(filePath)), 'Preview must display the native filename');
  assert(!document.body.textContent.includes(root), 'Preview should not show the whole directory');
  button('Cancel').click();
  assert.equal(published.length, 0, 'Cancel must not publish');
  assert.equal(closed, 1);
  unmount();
  render(<ModalPublishPreview {...preview} />, store, history);
  button('Upload').click();
  assert.deepEqual(published, [[filePath, false]], 'Confirmation must retain the full SDK file path');
  assert.equal(closed, 2);
  unmount();
  render(<ModalPublishPreview {...preview} filePath={undefined} isStillEditing />, store, history);
  button('Save').click();
  assert.deepEqual(published[1], [undefined, false], 'Metadata-only edits must not submit the display placeholder');
  unmount();
  render(<ModalPublishPreview {...preview} publishing />, store, history);
  assert(button('Uploading').disabled, 'A running publish must not be submitted twice');
  unmount();

  const changes = [];
  const descriptions = [];
  const urls = [];
  const licenseProps = {
    licenseType: NONE,
    handleLicenseChange: (...args) => changes.push(args),
    handleLicenseDescriptionChange: (event) => descriptions.push(event.target.value),
    handleLicenseUrlChange: (event) => urls.push(event.target.value),
  };
  render(<LicenseType {...licenseProps} />, store, history);
  const select = document.querySelector('select');
  select.value = CC_LICENSES[0].value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await tick();
  assert.deepEqual(changes[0], [CC_LICENSES[0].value, CC_LICENSES[0].url]);
  select.value = OTHER;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await tick();
  assert.deepEqual(changes[1], [OTHER, null], 'Custom licenses must clear the predefined URL');
  render(<LicenseType {...licenseProps} licenseType={OTHER} />, store, history);
  input('other-license-description', 'Custom license');
  input('other-license-url', 'https://fixture.invalid/license');
  assert.deepEqual(descriptions, ['Custom license']);
  assert.deepEqual(urls, ['https://fixture.invalid/license']);
  unmount();

  // Model a machine without a Markdown MIME registration; retain real FileReader behavior.
  const fileDetails = desktop.fileDetails;
  const updates = [];
  const modes = [];
  desktop.fileDetails = async (selected) => ({
    path: selected,
    name: path.basename(selected),
    mime: 'application/octet-stream',
    size: 13,
    buffer: new TextEncoder().encode('# Local post'),
  });
  try {
    render(
      <PublishFile
        filePath={path.join(root, 'post.MD')}
        mode={PUBLISH_MODES.FILE}
        name="post"
        title="Local post"
        balance={1}
        updatePublishForm={(value) => updates.push(value)}
        setPublishMode={(value) => modes.push(value)}
        setPrevFileText={() => {}}
      />,
      store,
      history
    );
    await waitFor(
      () => updates.some((value) => value.fileText === '# Local post'),
      'Markdown fallback must read the selected file'
    );
    assert.equal(modes.at(-1), PUBLISH_MODES.POST);
  } finally {
    unmount();
    desktop.fileDetails = fileDetails;
  }

  const video = path.join(root, 'thumbnail-source.mp4');
  fs.copyFileSync(path.resolve('build/tests/fixtures/media/sample.mp4'), video);
  const uploads = [];
  const toasts = [];
  const mountCapture = () =>
    render(
      <ModalAutoGenerateThumbnail
        filePath={video}
        upload={(file) => uploads.push(file)}
        closeModal={() => closed++}
        showToast={(toast) => toasts.push(toast)}
      />,
      store,
      history
    );
  mountCapture();
  const player = document.querySelector('video');
  await waitFor(() => player.readyState >= 2, 'Local video frame must load for thumbnail capture');
  assert.equal(player.width, 450);
  assert(player.height > 0);
  button('Upload').click();
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].type, 'image/png');
  assert.equal(uploads[0].name, 'thumbnail.png');
  const bytes = new Uint8Array(await uploads[0].arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10], 'Snapshot must contain PNG bytes');
  const bitmap = await createImageBitmap(uploads[0]);
  assert.equal(bitmap.width, player.videoWidth);
  assert.equal(bitmap.height, player.videoHeight);
  bitmap.close();
  const before = closed;
  // A missing frame must stay open and show an error, without uploading an empty file.
  Object.defineProperty(player, 'videoWidth', { value: 0 });
  button('Upload').click();
  assert.equal(uploads.length, 1);
  assert.equal(closed, before);
  assert.equal(toasts.at(-1).isError, true);
  unmount();
}
