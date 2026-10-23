import { strict as assert } from 'assert';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { ipcRenderer, webUtils } from 'electron';
import * as MODALS from 'constants/modal_types';
import * as THUMBNAIL_STATUSES from 'constants/thumbnail_upload_statuses';
import FileDrop from 'component/fileDrop/view';
import ModalFileSelection from 'modal/modalFileSelection/view';
import FileList from 'component/common/file-list';
import SelectThumbnail from 'component/selectThumbnail/view';
import ModalConfirmThumbnailUpload from 'modal/modalConfirmThumbnailUpload/view';
import PublishFile from 'component/publishFile/view';
import * as PUBLISH_MODES from 'constants/publish_types';
import { render, unmount, waitFor, tick } from './helpers';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const button = (label) => Array.from(document.querySelectorAll('button')).find((item) => item.textContent === label);

export default async function fileUploads(store, history, root) {
  // Match ui/index.jsx: cancel Chromium's default navigation on external drops.
  const preventDefault = (event) => event.preventDefault();
  document.addEventListener('dragover', preventDefault);
  document.addEventListener('drop', preventDefault);
  const first = path.join(root, 'first', 'same ł #1.txt');
  const second = path.join(root, 'second', path.basename(first));
  for (const [index, file] of [first, second].entries()) {
    fs.mkdirSync(path.dirname(file));
    fs.writeFileSync(file, 'Selected file ' + index);
  }
  const updates = [];
  const modals = [];
  const updatePublishForm = (value) => {
    assert.equal(history.location.pathname, '/$/upload', 'Navigate before assigning the selected file');
    updates.push(value);
  };
  const openModal = (id, props) => modals.push({ id, props });
  const mountDrop = () =>
    render(<FileDrop openModal={openModal} updatePublishForm={updatePublishForm} />, store, history);
  const drop = (files) => ipcRenderer.invoke('fixture-file-drop', files);
  history.push('/');
  mountDrop();
  await tick();
  await drop([first]);
  await waitFor(() => updates.length === 1, 'A native file drop must select its full local path');
  assert.deepEqual(updates, [{ filePath: first }]);
  await delay(1200);
  assert.equal(updates.length, 1, 'Hiding the drop overlay must not replay the previous drop');
  await drop([second]);
  await waitFor(() => updates.length === 2, 'A second drop must replace the previous file');
  assert.deepEqual(updates[1], { filePath: second });

  await drop([first, second]);
  await waitFor(() => modals.length === 1, 'Multiple files must open the chooser once');
  assert.equal(modals[0].id, MODALS.FILE_SELECTION);
  const files = modals[0].props.files;
  assert.deepEqual(
    files.map((file) => webUtils.getPathForFile(file)),
    [first, second]
  );
  await delay(1200);
  assert.equal(modals.length, 1, 'Clearing the overlay must not reopen the chooser');
  assert.equal(updates.length, 2, 'Multiple files require an explicit choice');
  unmount();

  let closed = 0;
  const mountChooser = (choices) =>
    render(
      <ModalFileSelection files={choices} hideModal={() => closed++} updatePublishForm={updatePublishForm} />,
      store,
      history
    );
  mountChooser(files);
  await waitFor(() => button('Accept') && !button('Accept').disabled, 'Chooser must select a default file');
  button('Cancel').click();
  assert.equal(closed, 1);
  assert.equal(updates.length, 2, 'Cancel must not change the publish form');
  unmount();

  history.push('/');
  mountChooser(files);
  await waitFor(() => button('Accept') && !button('Accept').disabled, 'Chooser did not become ready');
  await ipcRenderer.invoke('fixture-file-focus');
  const radios = document.querySelectorAll('input[type=radio]');
  assert(radios[0].checked && !radios[1].checked);
  assert.equal(radios[0].name, radios[1].name, 'The chooser must expose a native radio group');
  radios[0].focus();
  await ipcRenderer.invoke('fixture-controls-key', 'ArrowDown');
  await waitFor(() => radios[1].checked, 'Native arrow navigation must select the next file');
  assert.equal(document.activeElement, radios[1]);
  await ipcRenderer.invoke('fixture-controls-key', 'ArrowUp');
  await waitFor(() => radios[0].checked, 'Native arrow navigation must return to the first file');
  document.querySelector(`label[for="${radios[1].id}"]`).click();
  await tick();
  button('Accept').click();
  assert.equal(closed, 2);
  assert.deepEqual(updates[2], { filePath: second }, 'Identical filenames must still select the chosen directory');
  unmount();

  mountChooser([new File(['memory'], 'no-local-path.txt')]);
  await tick();
  assert(button('Accept').disabled, 'Files without a native path must not be submitted');
  unmount();

  mountChooser([]);
  await tick();
  assert(button('Accept').disabled, 'An empty chooser must not submit an old selection');
  unmount();

  const selections = [];
  const choose = (file) => selections.push(file);
  const ignore = () => {};
  const mountGroups = (choices) =>
    render(
      <>
        <FileList files={choices} onChange={choose} />
        <FileList files={files} onChange={ignore} />
      </>,
      store,
      history
    );
  mountGroups(files);
  await tick();
  const groups = document.querySelectorAll('[role="radiogroup"]');
  const firstGroup = groups[0].querySelectorAll('input');
  const secondGroup = groups[1].querySelectorAll('input');
  assert.notEqual(firstGroup[0].name, secondGroup[0].name, 'Independent file lists need independent radio names');
  assert.equal(new Set(Array.from(document.querySelectorAll('input'), (field) => field.id)).size, 4);
  firstGroup[1].click();
  await tick();
  assert.equal(selections[selections.length - 1], files[1]);
  assert(secondGroup[0].checked, 'Selecting a file must not clear another list');
  mountGroups([files[0]]);
  await waitFor(
    () => selections[selections.length - 1] === files[0],
    'Removing the selected row must select the remaining file'
  );
  assert(document.querySelector('input').checked);
  mountGroups([]);
  await waitFor(() => selections[selections.length - 1] === undefined, 'An emptied file list must clear its selection');
  unmount();

  mountDrop();
  await tick();
  const transfer = new DataTransfer();
  transfer.items.add(new File(['memory'], 'no-local-path.txt'));
  document.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  await waitFor(() => document.querySelector('[role=alert]'), 'A drop without a local path must show an error');
  button('Dismiss').click();
  assert.equal(document.querySelector('.file-drop').getAttribute('aria-hidden'), 'true');
  assert.equal(updates.length, 3, 'An invalid drop must not replace the selected file');
  await drop([first]);
  await waitFor(
    () => document.querySelector('.file-drop').textContent.includes(path.basename(first)),
    'Drop not received'
  );
  unmount();
  await delay(1200);
  assert.equal(updates.length, 3, 'Leaving the app must cancel delayed drop navigation');

  mountDrop();
  await tick();
  await drop([first]);
  await waitFor(
    () => document.querySelector('.file-drop').textContent.includes(path.basename(first)),
    'First drop not received'
  );
  await drop([second]);
  await waitFor(() => updates.length === 4, 'A newer drop must replace pending navigation');
  assert.deepEqual(updates[3], { filePath: second });
  await delay(1200);
  assert.equal(updates.length, 4, 'The replaced drop must not navigate later');
  unmount();

  // The thumbnail form passes a FileWithPath wrapper to the confirmation modal.
  // Its .path metadata remains valid even though native File.path no longer exists.
  const thumbnail = path.join(root, 'thumbnail ł #1.png');
  fs.writeFileSync(
    thumbnail,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=',
      'base64'
    )
  );
  const thumbnailModals = [];
  render(
    <SelectThumbnail
      fileInfos={{}}
      uploadThumbnailStatus={THUMBNAIL_STATUSES.READY}
      usePublishFormMode
      updatePublishForm={() => {}}
      openModal={(id, props) => thumbnailModals.push({ id, props })}
    />,
    store,
    history
  );
  await ipcRenderer.invoke('fixture-file-input', thumbnail);
  await waitFor(() => thumbnailModals.length === 1, 'Thumbnail selection did not open confirmation');
  assert.equal(thumbnailModals[0].id, MODALS.CONFIRM_THUMBNAIL_UPLOAD);
  const selection = thumbnailModals[0].props;
  assert.equal(selection.file.path, thumbnail);
  assert.equal(selection.file.file.path, undefined);
  assert.deepEqual(Buffer.from(await selection.file.file.arrayBuffer()), fs.readFileSync(thumbnail));
  unmount();
  const uploads = [];
  const thumbnailUpdates = [];
  const mountConfirm = () =>
    render(
      <ModalConfirmThumbnailUpload
        {...selection}
        closeModal={() => closed++}
        upload={(...args) => uploads.push(args)}
        updatePublishForm={(value) => thumbnailUpdates.push(value)}
      />,
      store,
      history
    );
  mountConfirm();
  button('Cancel').click();
  assert.equal(uploads.length, 0, 'Cancel must not upload the thumbnail');
  assert.equal(thumbnailUpdates.length, 0);
  unmount();
  mountConfirm();
  button('Upload').click();
  assert.deepEqual(uploads, [[selection.file, selection.cb]]);
  assert.deepEqual(thumbnailUpdates, [{ thumbnailPath: thumbnail }]);
  unmount();
  document.removeEventListener('dragover', preventDefault);
  document.removeEventListener('drop', preventDefault);
  const draft = path.join(root, 'restored-draft.mp4');
  fs.writeFileSync(draft, 'Synthetic draft file');
  const draftUpdates = [];
  const mountDraft = (filePath) =>
    render(
      <PublishFile
        filePath={filePath}
        mode={PUBLISH_MODES.FILE}
        name="restored-draft"
        title="Keep my title"
        updatePublishForm={(value) => draftUpdates.push(value)}
        setPublishMode={() => {}}
        setPrevFileText={() => {}}
        balance={1}
      />,
      store,
      history
    );
  mountDraft(draft);
  await waitFor(
    () => document.querySelector('[role=alert]'),
    'A draft must explain that its file needs selecting again'
  );
  assert(draftUpdates.some((value) => value.filePath === ''));
  assert(
    !draftUpdates.some((value) => 'title' in value || 'name' in value),
    'Keep draft metadata after denied file access'
  );
  mountDraft('');
  await ipcRenderer.invoke('fixture-grant-file', draft);
  mountDraft(draft);
  await waitFor(
    () => draftUpdates.some((value) => value.fileSize === fs.statSync(draft).size),
    'A newly selected draft file must load'
  );
  assert.equal(document.querySelector('[role=alert]'), null);
  unmount();
  return 'native file drops, duplicate filenames, chooser cancel/accept, pending navigation cleanup, thumbnails and restored draft file selection';
}
