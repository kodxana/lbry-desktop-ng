import { strict as assert } from 'assert';
import { ipcRenderer } from 'electron';
import React, { useState } from 'react';
import FormFieldAreaAdvanced from 'component/common/form-components/form-field-area-advanced';
import { render, unmount, waitFor, tick } from './helpers';

export default async function markdownEditor(store, history) {
  const fixture = (...args) => ipcRenderer.invoke('fixture-context-menu', ...args);
  const { nativeClipboard } = await fixture('configure');
  let update;
  let form;
  const changes = [];
  function Editor() {
    const [state, setState] = useState({ value: 'Draft ł', limit: 1000, disabled: false, type: 'markdown' });
    form = state;
    update = (next) => setState((current) => ({ ...current, ...next }));
    return (
      <FormFieldAreaAdvanced
        name="editor-fixture"
        label="Post text"
        type={state.type}
        hideSuggestions
        value={state.value}
        disabled={state.disabled}
        textAreaMaxLength={state.limit}
        charCount={state.value.length}
        placeholder="Write a post"
        onChange={(value) => {
          const text = typeof value === 'string' ? value : value.target.value;
          changes.push(text);
          setState((current) => ({ ...current, value: text }));
        }}
      />
    );
  }
  const currentEditor = () => document.querySelector('.CodeMirror')?.CodeMirror;
  const change = async (next) => {
    update(next);
    await waitFor(() => Object.entries(next).every(([key, value]) => form[key] === value), 'Editor props must update');
    await waitFor(() => {
      const editor = currentEditor();
      return form.type === 'markdown'
        ? editor && editor.getValue() === form.value && editor.getOption('readOnly') === form.disabled
        : !editor && document.getElementById('editor-fixture')?.value === form.value;
    }, 'The editor must apply loaded values and disabled state before another user action');
    await tick();
  };
  const input = async (text) => {
    currentEditor().focus();
    await ipcRenderer.invoke('fixture-editor-input', { text });
    await tick();
    await tick();
  };
  const shortcut = async (key) => {
    currentEditor().focus();
    await ipcRenderer.invoke('fixture-editor-input', { key, modifiers: ['control'] });
    await tick();
  };
  try {
    render(<Editor />, store, history);
    await waitFor(
      () => currentEditor()?.getInputField().getAttribute('aria-label') === 'Post text',
      'Markdown editor must finish initialization and receive its accessible label'
    );
    const editor = currentEditor();
    const wrapper = editor.getWrapperElement();
    assert.equal(editor.getValue(), 'Draft ł');
    assert.equal(editor.getInputField().getAttribute('aria-label'), 'Post text');
    editor.setCursor(0, 7);
    const beforeTyping = changes.length;
    await input(' draft');
    await waitFor(() => form.value === 'Draft ł draft', 'Typing did not update the controlled draft');
    assert.equal(currentEditor(), editor, 'Typing must not recreate the editor');
    assert.equal(changes.length, beforeTyping + 1, 'One edit must notify the form once');
    assert.equal(editor.getCursor().ch, 13);
    assert(editor.hasFocus(), 'Typing must preserve focus');
    const undoSize = editor.historySize().undo;
    await change({ limit: 2000 });
    assert.equal(currentEditor(), editor, 'A parent rerender must preserve the editor');
    assert.equal(editor.historySize().undo, undoSize);
    await shortcut('Z');
    await waitFor(() => form.value === 'Draft ł', 'Undo did not survive the parent rerender');

    await change({ value: 'format this' });
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 6 });
    document.querySelector('.editor-toolbar .bold').click();
    await waitFor(() => form.value === '**format** this', 'Bold toolbar lost the selected text');
    await change({ value: 'label' });
    editor.execCommand('selectAll');
    await shortcut('K');
    await waitFor(() => editor.getSelection() === 'https://', 'Ctrl-K must select the URL placeholder');
    assert.equal(form.value, '[label](https://)');
    await change({ value: 'first\nsecond' });
    editor.execCommand('selectAll');
    document.querySelector('.editor-toolbar .link').click();
    await waitFor(() => editor.getSelection() === 'https://', 'Multiline toolbar link must select the URL');
    assert.equal(form.value, '[first\nsecond](https://)');

    await change({ value: '12345', limit: 8 });
    editor.setCursor(0, 5);
    await input('67890');
    await waitFor(() => form.value === '12345678', 'Insertion must stop at the current length limit');
    editor.setSelection({ line: 0, ch: 1 }, { line: 0, ch: 4 });
    await input('ab\ncd');
    assert.equal(form.value, '1ab\n5678', 'Multiline replacement must count the removed selection');
    await change({ limit: 6 });
    editor.execCommand('selectAll');
    await input('abcdefghi');
    assert.equal(form.value, 'abcdef', 'An updated limit must apply without recreating the editor');
    await change({ value: 'A restored draft longer than its limit' });
    assert.equal(editor.getValue(), form.value, 'Restoring a longer draft must never truncate it');

    await change({ disabled: true });
    const disabledValue = form.value;
    const beforeDisabledInput = changes.length;
    editor.setCursor(0, 0);
    await input('blocked');
    assert.equal(editor.getValue(), disabledValue);
    assert.equal(form.value, disabledValue);
    assert.equal(changes.length, beforeDisabledInput);
    assert.equal(editor.getOption('readOnly'), true);
    assert(Array.from(document.querySelectorAll('.editor-toolbar button')).every((button) => button.disabled));
    await change({ value: 'Loaded post while disabled' });
    assert.equal(editor.getValue(), form.value);
    await change({ disabled: false, limit: 1000, value: 'hello café qzxqzxqzx' });
    assert.equal(currentEditor(), editor);
    await waitFor(() => document.querySelector('.cm-spell-error'), 'Bundled spelling dictionary did not load');
    assert.equal(editor.getTokenTypeAt({ line: 0, ch: 2 })?.includes('spell-error') || false, false);
    assert.equal(
      editor.getTokenTypeAt({ line: 0, ch: 9 })?.includes('spell-error') || false,
      false,
      'The bundled Latin-1 dictionary must retain accented words'
    );
    await document.fonts.load('14px FontAwesome', '\uf032');
    assert(document.fonts.check('14px FontAwesome', '\uf032'), 'Toolbar font must load from the package');
    assert.equal(
      getComputedStyle(document.querySelector('.editor-toolbar .bold i')).fontFamily.includes('FontAwesome'),
      true
    );

    await change({
      value: '**Preview**\n\n[Channel](lbry://@fixture#abc)\n\n<script>window.editorInjected = true</script>',
    });
    document.querySelector('.editor-toolbar .preview').click();
    await waitFor(() => document.querySelector('.editor-preview-active strong'), 'Markdown preview did not render');
    const preview = document.querySelector('.editor-preview-active');
    assert.equal(preview.querySelector('strong').textContent, 'Preview');
    assert.equal(preview.querySelector('a').textContent, 'Channel');
    assert.equal(
      preview.querySelector('a').getAttribute('href'),
      null,
      'The editor preview must keep LBRY links inert, as before'
    );
    assert(!preview.querySelector('script'));
    assert.equal(window.editorInjected, undefined);
    document.querySelector('.editor-toolbar .preview').click();

    const before = (await fixture()).requests;
    const code = wrapper.querySelector('.CodeMirror-code');
    const bounds = code.getBoundingClientRect();
    code.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: bounds.left + 2,
        clientY: bounds.top + 5,
      })
    );
    await waitFor(async () => (await fixture()).requests === before + 1, 'Editor context menu must open once');
    await fixture('choose', 'editor-select-all');
    await waitFor(() => editor.getSelection() === editor.getValue(), 'Native menu Select All failed');
    const requests = (await fixture()).requests;
    code.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: bounds.left + 2,
        clientY: bounds.top + 5,
      })
    );
    await waitFor(async () => (await fixture()).requests === requests + 1, 'Paste menu did not open');
    await fixture('paste-fixture');
    await fixture('choose', 'paste');
    assert.deepEqual((await fixture()).commands, ['paste']);
    if (nativeClipboard) {
      await waitFor(() => form.value === 'Synthetic paste ł', 'Native paste must update the Markdown draft');
    }

    const draft = form.value;
    await change({ type: 'textarea' });
    assert(!document.querySelector('.CodeMirror'));
    assert.equal(document.getElementById('editor-fixture').value, draft);
    await change({ type: 'markdown' });
    await waitFor(currentEditor, 'Switching back must recreate the editor');
    await tick();
    assert.equal(currentEditor().getValue(), draft);
    assert.equal(document.querySelectorAll('.CodeMirror').length, 1);
    // Navigation can unmount the editor before its delayed link-selection callback fires.
    await change({ value: 'last link' });
    currentEditor().execCommand('selectAll');
    document.querySelector('.editor-toolbar .link').click();
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert(!document.querySelector('.CodeMirror'));
    assert(changes.length > 0);
    return 'Markdown editor: typing/focus/undo, formatting and links, live limits, restored drafts, disabled state, offline font/spelling, safe preview, native menu/paste and mode/unmount cleanup';
  } finally {
    unmount();
  }
}
