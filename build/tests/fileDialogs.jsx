import { strict as assert } from 'assert';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { ipcRenderer } from 'electron';
import FileSelector from 'component/common/file-selector';
import { render, unmount, waitFor } from './helpers';

export default async function fileDialogs(store, history, root) {
  const selected = path.join(root, 'chosen ł #1.txt');
  const contents = 'File selection fixture\nZażółć';
  fs.writeFileSync(selected, contents);
  const chosen = [];
  const onFileChosen = (value) => chosen.push(value);
  const browse = () => document.querySelector('button').click();
  const filters = [{ name: 'Text', extensions: ['txt'] }];
  render(<FileSelector type="openFile" filters={filters} onFileChosen={onFileChosen} />, store, history);
  await ipcRenderer.invoke('fixture-dialog', { canceled: true, filePaths: [selected] });
  browse();
  await waitFor(() => !document.querySelector('button').disabled, 'Cancel must re-enable Browse');
  let calls = await ipcRenderer.invoke('fixture-dialog', { canceled: false, filePaths: [selected] });
  assert.equal(chosen.length, 0);
  browse();
  await waitFor(() => chosen.length === 1, 'Selected native file was not delivered');
  assert.equal(chosen[0].path, selected);
  assert.equal(chosen[0].file.name, path.basename(selected));
  assert.equal(chosen[0].file.type, 'text/plain');
  assert.equal(await chosen[0].file.text(), contents);
  calls = await ipcRenderer.invoke('fixture-dialog', null);
  assert.deepEqual(calls.dialogs[0].properties, ['openFile']);
  assert.deepEqual(calls.dialogs[0].filters, filters);
  unmount();

  render(<FileSelector type="openDirectory" readFile={false} onFileChosen={onFileChosen} />, store, history);
  await ipcRenderer.invoke('fixture-dialog', { canceled: false, filePaths: [root] });
  browse();
  await waitFor(() => chosen.length === 2, 'Directory selection was not delivered');
  assert.equal(chosen[1].path, root);
  assert.equal(chosen[1].file.size, 0);
  calls = await ipcRenderer.invoke('fixture-dialog', null);
  assert.deepEqual(calls.dialogs[2].properties, ['openDirectory']);
  unmount();

  render(<FileSelector type="openFile" readFile={false} onFileChosen={onFileChosen} />, store, history);
  await ipcRenderer.invoke('fixture-dialog', { canceled: false, filePaths: [selected] });
  browse();
  await waitFor(() => chosen.length === 3, 'Metadata-only selection was not delivered');
  assert.equal(chosen[2].file.size, 0);
  assert.equal(chosen[2].file.type, 'text/plain');
  unmount();

  // Chromium provides an actual disk-backed File with no legacy File.path property.
  render(<FileSelector onFileChosen={onFileChosen} />, store, history);
  document.querySelector('input[type=file]').dispatchEvent(new Event('change', { bubbles: true }));
  assert.equal(chosen.length, 3, 'An empty file input must be treated as cancellation');
  for (let count = 4; count <= 5; count++) {
    await ipcRenderer.invoke('fixture-file-input', selected);
    await waitFor(() => chosen.length === count, 'File input must allow choosing the same file again');
    assert.equal(chosen[count - 1].path, selected);
    assert.equal(chosen[count - 1].file.path, undefined);
    assert.equal(await chosen[count - 1].file.text(), contents);
    assert.equal(document.querySelector('input[type=file]').value, '');
  }
  const transfer = new DataTransfer();
  transfer.items.add(new File(['memory only'], 'unavailable.txt'));
  document.querySelector('input[type=file]').files = transfer.files;
  document.querySelector('input[type=file]').dispatchEvent(new Event('change', { bubbles: true }));
  assert.equal(chosen.length, 5, 'A synthetic File must not become a guessed local path');
  assert(document.body.textContent.includes('could not be opened'));
  unmount();
  render(<FileSelector type="openFile" disabled onFileChosen={onFileChosen} />, store, history);
  calls = await ipcRenderer.invoke('fixture-dialog', null);
  browse();
  assert.equal((await ipcRenderer.invoke('fixture-dialog', null)).dialogs.length, calls.dialogs.length);
  unmount();
  render(<FileSelector type="openFile" onFileChosen={onFileChosen} />, store, history);
  for (const response of [
    { error: 'Synthetic dialog failure' },
    { canceled: false, filePaths: [path.join(root, 'removed-file')] },
  ]) {
    await ipcRenderer.invoke('fixture-dialog', response);
    browse();
    await waitFor(
      () => document.body.textContent.includes('could not be opened'),
      'Dialog and file read failures must be visible'
    );
    assert.equal(chosen.length, 5);
  }
  await ipcRenderer.invoke('fixture-dialog', { canceled: false, filePaths: [selected] });
  browse();
  await waitFor(() => chosen.length === 6, 'A failed selection must be retryable');
  assert(!document.body.textContent.includes('could not be opened'));
  unmount();

  const selector = React.createRef();
  render(<FileSelector ref={selector} type="openFile" onFileChosen={onFileChosen} />, store, history);
  const before = (await ipcRenderer.invoke('fixture-dialog', { hold: true, canceled: false, filePaths: [selected] }))
    .dialogs.length;
  browse();
  browse();
  await waitFor(async () => (await ipcRenderer.invoke('fixture-dialog')).pending, 'Native dialog was not opened');
  assert(document.querySelector('button').disabled, 'Pending native selection must disable Browse');
  assert.equal(
    (await ipcRenderer.invoke('fixture-dialog')).dialogs.length,
    before + 1,
    'Double clicks must open only one dialog'
  );
  assert.deepEqual(await ipcRenderer.invoke('select-file', { type: 'openFile' }), { ok: false, error: 'busy' });
  // Leaving the form must not deliver the old selection into a new form.
  const unmountedSelector = selector.current;
  unmount();
  render(<FileSelector type="openFile" onFileChosen={onFileChosen} />, store, history);
  await ipcRenderer.invoke('fixture-dialog-release');
  await waitFor(() => !unmountedSelector.selecting, 'Held selection did not finish');
  assert.equal(chosen.length, 6, 'An unmounted selector must not deliver its old result');
  await ipcRenderer.invoke('fixture-dialog', { canceled: false, filePaths: [selected] });
  browse();
  await waitFor(() => chosen.length === 7, 'A new form must be able to select after the previous form unmounts');
  assert(!document.body.textContent.includes('could not be opened'));
  unmount();
  return 'native dialog options/cancel/errors/retry, scoped file IPC, metadata-only folders/files, webUtils paths, repeat selection, missing paths, pending dialogs and unmounted selectors';
}
