import { strict as assert } from 'assert';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { ipcRenderer } from 'electron';
import FileSelector from 'component/common/file-selector';
import { render, unmount, waitFor, tick } from './helpers';

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
  await tick();
  let calls = await ipcRenderer.invoke('fixture-dialog', { canceled: false, filePaths: [selected] });
  assert.equal(calls.reads.length, 0, 'Cancel must not read a file');
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
  assert.equal(calls.reads[1].read, false);
  unmount();

  render(<FileSelector type="openFile" readFile={false} onFileChosen={onFileChosen} />, store, history);
  await ipcRenderer.invoke('fixture-dialog', { canceled: false, filePaths: [selected] });
  browse();
  await waitFor(() => chosen.length === 3, 'Metadata-only selection was not delivered');
  assert.equal(chosen[2].file.size, 0);
  assert.equal(chosen[2].file.type, 'text/plain');
  unmount();

  // Chromium provides an actual disk-backed File, exercising Electron's File.path contract.
  render(<FileSelector onFileChosen={onFileChosen} />, store, history);
  document.querySelector('input[type=file]').dispatchEvent(new Event('change', { bubbles: true }));
  assert.equal(chosen.length, 3, 'An empty file input must be treated as cancellation');
  for (let count = 4; count <= 5; count++) {
    await ipcRenderer.invoke('fixture-file-input', selected);
    await waitFor(() => chosen.length === count, 'File input must allow choosing the same file again');
    assert.equal(chosen[count - 1].path, selected);
    assert.equal(await chosen[count - 1].file.text(), contents);
    assert.equal(document.querySelector('input[type=file]').value, '');
  }
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
  return 'native dialog options/cancel/errors/retry, real file IPC, metadata-only folders/files, File.path, repeat selection and disabled browse';
}
