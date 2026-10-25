import 'scss/third-party.scss';
import 'scss/all.scss';
import { strict as assert } from 'assert';
import { ipcRenderer } from 'electron';
import React, { useState } from 'react';
import { EditorView } from '@codemirror/view';
import { selectAll, undoDepth } from '@codemirror/commands';
import FormFieldAreaAdvanced from 'component/common/form-components/form-field-area-advanced';
import { render, unmount, waitFor, tick } from './helpers';

export default async function markdownEditor(store, history) {
  document.documentElement.setAttribute('dir', 'ltr');
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
  const currentEditor = () =>
    document.querySelector('.cm-editor') && EditorView.findFromDOM(document.querySelector('.cm-editor'));
  const change = async (next) => {
    update(next);
    await waitFor(() => Object.entries(next).every(([key, value]) => form[key] === value), 'Editor props must update');
    await waitFor(() => {
      const editor = currentEditor();
      return form.type === 'markdown'
        ? editor && editor.state.doc.toString() === form.value && editor.state.readOnly === form.disabled
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
  const shortcut = async (key, modifiers = ['control']) => {
    currentEditor().focus();
    await ipcRenderer.invoke('fixture-editor-input', { key, modifiers });
    await tick();
  };
  try {
    render(<Editor />, store, history);
    await waitFor(
      () => currentEditor()?.contentDOM.getAttribute('aria-label') === 'Post text',
      'Markdown editor must finish initialization and receive its accessible label'
    );
    const editor = currentEditor();
    const wrapper = editor.dom;
    assert.equal(editor.state.doc.toString(), 'Draft ł');
    assert.equal(editor.contentDOM.getAttribute('aria-label'), 'Post text');
    editor.dispatch({ selection: { anchor: 7 } });
    const beforeTyping = changes.length;
    await input(' draft');
    await waitFor(() => form.value === 'Draft ł draft', 'Typing did not update the controlled draft');
    assert.equal(currentEditor(), editor, 'Typing must not recreate the editor');
    assert.equal(changes.length, beforeTyping + 1, 'One edit must notify the form once');
    assert.equal(editor.state.selection.main.head, 13);
    assert(editor.hasFocus, 'Typing must preserve focus');
    const undoSize = undoDepth(editor.state);
    await change({ limit: 2000 });
    assert.equal(currentEditor(), editor, 'A parent rerender must preserve the editor');
    assert.equal(undoDepth(editor.state), undoSize);
    await shortcut('Z');
    await waitFor(() => form.value === 'Draft ł', 'Undo did not survive the parent rerender');

    await change({ value: 'format this' });
    editor.dispatch({ selection: { anchor: 0, head: 6 } });
    document.querySelector('.editor-toolbar .bold').click();
    await waitFor(() => form.value === '**format** this', 'Bold toolbar lost the selected text');
    await shortcut('I');
    await waitFor(() => form.value === '***format*** this', 'Italic must preserve existing bold formatting');
    await shortcut('I');
    await waitFor(() => form.value === '**format** this', 'Removing italic must keep bold');
    document.querySelector('.editor-toolbar .bold').click();
    await waitFor(() => form.value === 'format this', 'Bold must toggle off without losing selection');
    await shortcut('I');
    await waitFor(() => form.value === '*format* this', 'Italic shortcut must format the selection');
    await shortcut('I');
    await waitFor(() => form.value === 'format this', 'Italic must toggle off');
    for (const [button, expected] of [
      ['quote', '> first\n> second'],
      ['unordered-list', '* first\n* second'],
      ['ordered-list', '1. first\n2. second'],
    ]) {
      await change({ value: 'first\nsecond' });
      selectAll(editor);
      document.querySelector('.editor-toolbar .' + button).click();
      await waitFor(() => form.value === expected, button + ' must format every selected line');
      document.querySelector('.editor-toolbar .' + button).click();
      await waitFor(() => form.value === 'first\nsecond', button + ' must toggle off');
    }
    for (const [key, modifiers, expected] of [
      ['H', ['control'], '# entry'],
      ['H', ['control', 'shift'], '###### entry'],
      ['3', ['control', 'alt'], '### entry'],
      ['L', ['control', 'shift'], '* [ ] entry'],
      ['C', ['control', 'alt'], '```\nentry\n```'],
      ['I', ['control', 'alt'], '![entry](https://)'],
    ]) {
      await change({ value: 'entry' });
      selectAll(editor);
      await shortcut(key, modifiers);
      await waitFor(() => form.value === expected, 'Existing Markdown shortcut must be retained: ' + key + modifiers);
    }
    await change({ value: '### entry' });
    selectAll(editor);
    await shortcut('E');
    await waitFor(() => form.value === 'entry', 'Clean block shortcut must remove the heading');
    await change({ value: '* one' });
    editor.dispatch({ selection: { anchor: 5 } });
    await shortcut('Enter', []);
    await waitFor(() => form.value === '* one\n* ', 'Enter must continue Markdown lists');
    await shortcut('Tab', []);
    await waitFor(() => form.value.includes('  * '), 'Tab must indent a Markdown list item');
    await shortcut('Tab', ['shift']);
    await waitFor(() => form.value === '* one\n* ', 'Shift-Tab must restore the list indentation');
    await input('two');
    await shortcut('Z');
    await shortcut('Y');
    await waitFor(() => form.value.endsWith('two'), 'Redo must restore text');
    await change({ value: '* [ ] one' });
    editor.dispatch({ selection: { anchor: 9 } });
    await shortcut('Enter', []);
    await waitFor(() => form.value === '* [ ] one\n* [ ] ', 'Enter must continue GFM task lists');
    await change({ value: '~~removed~~' });
    await waitFor(() => document.querySelector('.cm-strikethrough'), 'GFM highlighting must remain enabled');
    await change({ value: 'label' });
    selectAll(editor);
    await shortcut('K');
    await waitFor(
      () =>
        editor.state.doc.sliceString(editor.state.selection.main.from, editor.state.selection.main.to) === 'https://',
      'Ctrl-K must select the URL placeholder'
    );
    assert.equal(form.value, '[label](https://)');
    await change({ value: 'first\nsecond' });
    selectAll(editor);
    document.querySelector('.editor-toolbar .link').click();
    await waitFor(
      () =>
        editor.state.doc.sliceString(editor.state.selection.main.from, editor.state.selection.main.to) === 'https://',
      'Multiline toolbar link must select the URL'
    );
    assert.equal(form.value, '[first\nsecond](https://)');

    await change({ value: '12345', limit: 8 });
    editor.dispatch({ selection: { anchor: 5 } });
    await input('67890');
    await waitFor(() => form.value === '12345678', 'Insertion must stop at the current length limit');
    editor.dispatch({ selection: { anchor: 1, head: 4 } });
    await input('ab\ncd');
    assert.equal(form.value, '1ab\n5678', 'Multiline replacement must count the removed selection');
    await change({ limit: 6 });
    selectAll(editor);
    await input('abcdefghi');
    assert.equal(form.value, 'abcdef', 'An updated limit must apply without recreating the editor');
    await change({ value: '12345', limit: 6 });
    editor.dispatch({ selection: { anchor: 5 } });
    await input('😀');
    assert.equal(form.value, '12345', 'Length limit must not split an emoji');
    await change({ limit: 7 });
    await input('😀');
    assert.equal(form.value, '12345😀', 'A complete emoji must fit when two UTF-16 units remain');
    selectAll(editor);
    document.querySelector('.editor-toolbar .bold').click();
    await tick();
    assert.equal(form.value, '12345😀', 'Formatting at the limit must not leave partial Markdown');
    await change({ value: '', limit: 1000 });
    editor.focus();
    await ipcRenderer.invoke('fixture-editor-input', { composition: 'にほん' });
    await tick();
    await input('日本');
    await waitFor(() => form.value === '日本', 'IME composition must commit without duplicated text');
    await change({ value: 'A restored draft longer than its limit' });
    assert.equal(editor.state.doc.toString(), form.value, 'Restoring a longer draft must never truncate it');

    await change({ disabled: true });
    const disabledValue = form.value;
    const beforeDisabledInput = changes.length;
    editor.dispatch({ selection: { anchor: 0 } });
    await input('blocked');
    assert.equal(editor.state.doc.toString(), disabledValue);
    assert.equal(form.value, disabledValue);
    assert.equal(changes.length, beforeDisabledInput);
    assert.equal(editor.state.readOnly, true);
    assert(Array.from(document.querySelectorAll('.editor-toolbar button')).every((button) => button.disabled));
    await change({ value: 'Loaded post while disabled' });
    assert.equal(editor.state.doc.toString(), form.value);
    await change({ disabled: false, limit: 1000, value: 'hello café qzxqzxqzx' });
    assert.equal(currentEditor(), editor);
    await waitFor(() => document.querySelector('.cm-spell-error'), 'Bundled spelling dictionary did not load');
    assert.deepEqual(
      Array.from(document.querySelectorAll('.cm-spell-error'), (node) => node.textContent),
      ['qzxqzxqzx'],
      'Offline spelling must recognize English and accented words'
    );
    await change({ value: 'hello `qzxqzxqzx`\n\n```js\nqzxqzxqzx\n```\n\n[text](https://qzxqzxqzx.invalid)' });
    await tick();
    assert.equal(document.querySelectorAll('.cm-spell-error').length, 0, 'Spelling must skip code and URL syntax');
    await change({
      value:
        '# A community post\n\nWrite **bold**, *italic* and [a link](lbry://@channel#abc).\n\n* Keep your drafts\n* Edit without distractions\n\nA misspelt qzxqzxqzx word.',
    });
    for (const theme of ['dark', 'light']) {
      document.documentElement.setAttribute('theme', theme);
      await tick();
      const swatch = document.createElement('div');
      swatch.style.backgroundColor = 'var(--color-input-bg)';
      document.body.appendChild(swatch);
      assert.equal(
        getComputedStyle(editor.dom).backgroundColor,
        getComputedStyle(swatch).backgroundColor,
        'The editor must use the active application theme'
      );
      swatch.remove();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await ipcRenderer.invoke('fixture-editor-capture', theme);
    }
    document.documentElement.setAttribute('theme', 'dark');
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
    await waitFor(
      () => !document.querySelector('.editor-preview-active') && editor.hasFocus,
      'Leaving preview must restore editor focus'
    );
    const beforeModes = editor.state.doc.toString();
    await shortcut('F9', []);
    await waitFor(() => document.querySelector('.markdown-editor__split'), 'F9 must retain side-by-side preview');
    assert.equal(editor.state.readOnly, false);
    await shortcut('F9', []);
    await shortcut('F11', []);
    await waitFor(() => document.querySelector('.markdown-editor--fullscreen'), 'F11 must retain editor fullscreen');
    await shortcut('Escape', []);
    await waitFor(() => !document.querySelector('.markdown-editor--fullscreen'), 'Escape must exit fullscreen');
    assert.equal(editor.state.doc.toString(), beforeModes);

    const before = (await fixture()).requests;
    const code = wrapper.querySelector('.cm-content');
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
    await waitFor(
      () =>
        editor.state.doc.sliceString(editor.state.selection.main.from, editor.state.selection.main.to) ===
        editor.state.doc.toString(),
      'Native menu Select All failed'
    );
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
    assert(!document.querySelector('.cm-editor'));
    assert.equal(document.getElementById('editor-fixture').value, draft);
    await change({ type: 'markdown' });
    await waitFor(currentEditor, 'Switching back must recreate the editor');
    await tick();
    assert.equal(currentEditor().state.doc.toString(), draft);
    assert.equal(document.querySelectorAll('.cm-editor').length, 1);
    // Navigation must destroy the view even immediately after a formatting transaction.
    await change({ value: 'last link' });
    selectAll(currentEditor());
    document.querySelector('.editor-toolbar .link').click();
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert(!document.querySelector('.cm-editor'));
    assert(changes.length > 0);
    return 'Markdown editor: typing/focus/undo, formatting and links, live limits, restored drafts, disabled state, offline font/spelling, safe preview, native menu/paste and mode/unmount cleanup';
  } finally {
    unmount();
  }
}
