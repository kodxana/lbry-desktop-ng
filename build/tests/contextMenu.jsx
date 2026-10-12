import { strict as assert } from 'assert';
import { clipboard, ipcRenderer, shell } from 'electron';
import CodeMirror from 'codemirror';
import {
  openContextMenu,
  openEditorMenu,
  openSnippetMenu,
  openClaimPreviewMenu,
  stopContextMenu,
} from 'util/context-menu';
import { convertToShareLink } from 'util/lbryURI';
import { waitFor } from './helpers';

export default async function contextMenu() {
  const fixture = (...args) => ipcRenderer.invoke('fixture-context-menu', ...args);
  const { nativeClipboard } = await fixture('configure');
  assert(document.hasFocus(), 'The hidden fixture must emulate an active document');
  const container = document.getElementById('app');
  container.addEventListener('contextmenu', stopContextMenu);
  const input = document.createElement('input');
  input.type = 'text';
  input.value = 'Synthetic selection ł';
  container.appendChild(input);
  const event = (target) => ({ target, clientX: 12, clientY: 34, preventDefault: () => {} });
  const invoke = (target = input) => openContextMenu(event(target));
  async function open(start) {
    const before = (await fixture()).requests;
    const pending = start();
    await waitFor(async () => (await fixture()).requests > before, 'Context menu did not reach the main process');
    return { pending, state: await fixture() };
  }
  async function choose(start, id) {
    const { pending } = await open(start);
    await fixture('choose', id);
    await pending;
  }

  input.focus();
  input.setSelectionRange(0, input.value.length);
  await choose(invoke, 'copy');
  assert.deepEqual((await fixture()).commands, ['copy']);
  if (nativeClipboard) {
    await waitFor(
      async () => (await fixture()).clipboard === input.value,
      'Native Copy did not copy selected input text'
    );
  }
  await choose(invoke, 'cut');
  assert.deepEqual((await fixture()).commands, ['copy', 'cut']);
  if (nativeClipboard) await waitFor(() => input.value === '', 'Native Cut did not update the input');
  await fixture('paste-fixture');
  await choose(invoke, 'paste');
  assert.deepEqual((await fixture()).commands, ['copy', 'cut', 'paste']);
  if (nativeClipboard) {
    await waitFor(() => input.value === 'Synthetic paste ł', 'Native Paste did not update the input');
  }

  input.value = 'Select all fixture';
  input.setSelectionRange(2, 3);
  await choose(invoke, 'select-all');
  await waitFor(
    () => input.selectionStart === 0 && input.selectionEnd === input.value.length,
    'Native Select All failed'
  );
  for (const property of ['readOnly', 'disabled']) {
    input[property] = true;
    input.setSelectionRange(2, 3);
    const { pending, state } = await open(invoke);
    assert(!state.items.some(({ id }) => id === 'cut' || id === 'paste'));
    if (property === 'readOnly') {
      await fixture('choose', 'select-all');
      await waitFor(
        () => input.selectionStart === 0 && input.selectionEnd === input.value.length,
        'Read-only fields must still support Select All'
      );
    } else {
      assert(!state.items.some(({ id }) => id === 'select-all'));
      await fixture('dismiss');
    }
    await pending;
    input[property] = false;
  }
  input.setSelectionRange(0, 0);
  const empty = await open(invoke);
  assert.equal(empty.state.items.find(({ id }) => id === 'copy').enabled, false);
  await fixture('dismiss');
  await empty.pending;

  const paragraph = document.createElement('p');
  paragraph.textContent = 'Document selection ł';
  container.appendChild(paragraph);
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  const documentMenu = await open(() => invoke(paragraph));
  assert.deepEqual(
    documentMenu.state.items.map(({ id, enabled }) => ({ id, enabled })),
    [{ id: 'copy', enabled: true }]
  );
  await fixture('choose', 'copy');
  await documentMenu.pending;
  if (nativeClipboard) {
    await waitFor(async () => (await fixture()).clipboard === paragraph.textContent, 'Native document Copy failed');
  }
  window.getSelection().removeAllRanges();

  const textarea = document.createElement('textarea');
  container.appendChild(textarea);
  const editor = CodeMirror.fromTextArea(textarea, { value: '', lineNumbers: true });
  editor.setValue('First line ł\nSecond line');
  const codeEvent = () => event(editor.getWrapperElement());
  let editorRequest;
  editor.on('contextmenu', (instance, nativeEvent) => {
    editorRequest = openEditorMenu(instance, nativeEvent);
  });
  const editorMenu = () => {
    input.focus();
    const code = editor.getWrapperElement().querySelector('.CodeMirror-code');
    const bounds = code.getBoundingClientRect();
    const nativeEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: bounds.left + 2,
      clientY: bounds.top + 5,
    });
    code.dispatchEvent(nativeEvent);
    assert(nativeEvent.defaultPrevented, 'The custom menu must suppress the browser context menu');
    assert(editor.hasFocus(), 'Right-click must focus the editor for native editing commands');
    const field = editor.getInputField();
    if (editor.somethingSelected()) {
      const nativeSelection = field.value.slice(field.selectionStart, field.selectionEnd);
      assert.equal(nativeSelection, editor.getSelection(), 'The native input must contain the CodeMirror selection');
    }
    return editorRequest;
  };
  await choose(editorMenu, 'editor-select-all');
  assert.equal(editor.getSelection(), editor.getValue(), 'Select All must select the full CodeMirror document');
  await choose(editorMenu, 'copy');
  if (nativeClipboard) {
    await waitFor(
      async () => (await fixture()).clipboard.replace(/\r\n/g, '\n') === editor.getValue(),
      'Native editor Copy failed'
    );
    await choose(editorMenu, 'cut');
    await waitFor(() => editor.getValue() === '', 'Native editor Cut failed');
    await fixture('paste-fixture');
    await choose(editorMenu, 'paste');
    await waitFor(() => editor.getValue() === 'Synthetic paste ł', 'Native editor Paste failed');
  }
  editor.setOption('readOnly', true);
  editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 1 });
  const snippet = await open(() => openSnippetMenu(editor, codeEvent()));
  assert(!snippet.state.items.some(({ id }) => id === 'cut' || id === 'paste'));
  await fixture('choose', 'editor-select-all');
  await snippet.pending;
  assert.equal(editor.getSelection(), editor.getValue());
  const readonlyEditor = await open(() => openEditorMenu(editor, codeEvent()));
  assert(!readonlyEditor.state.items.some(({ id }) => id === 'cut' || id === 'paste'));
  await fixture('dismiss');
  await readonlyEditor.pending;

  // Capture the two renderer-owned claim actions without opening a browser or
  // replacing the user's clipboard. Claim URLs keep their existing formatting.
  const writeText = clipboard.writeText;
  const openExternal = shell.openExternal;
  const actions = [];
  clipboard.writeText = (text) => actions.push(['copy', text]);
  shell.openExternal = async (url) => actions.push(['report', url]);
  try {
    const claim = { claim_id: 'a'.repeat(40), permanent_url: 'lbry://fixture#' + 'a'.repeat(40) };
    for (const id of ['copy-link', 'report']) {
      await choose(() => openClaimPreviewMenu(claim, event(paragraph)), id);
    }
    assert.deepEqual(actions, [
      ['copy', convertToShareLink(claim.permanent_url)],
      ['report', 'https://lbry.com/dmca/' + claim.claim_id],
    ]);
    const canceled = await open(() => openClaimPreviewMenu(claim, event(paragraph)));
    await fixture('dismiss');
    await canceled.pending;
    const stale = await open(() => openClaimPreviewMenu(claim, event(paragraph)));
    paragraph.remove();
    await fixture('choose', 'copy-link');
    await stale.pending;
    await openClaimPreviewMenu(null, event(input));
    assert.equal(actions.length, 2, 'Dismissed, removed and absent claims must not trigger actions');
  } finally {
    clipboard.writeText = writeText;
    shell.openExternal = openExternal;
    editor.toTextArea();
    container.removeEventListener('contextmenu', stopContextMenu);
    container.textContent = '';
  }
  return (
    'context menus: real IPC/native Menu, text/document selection, CodeMirror, read-only fields, claims and dismissal' +
    (nativeClipboard ? '; native clipboard editing verified' : '; clipboard boundary intercepted on this PC')
  );
}
