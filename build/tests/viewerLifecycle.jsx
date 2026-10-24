import { strict as assert } from 'assert';
import React from 'react';
import desktop from 'util/desktop';
import DocumentViewer from 'component/viewers/documentViewer';
import DocxViewer from 'component/viewers/docxViewer';
import CodeViewer from 'component/viewers/codeViewer';
import * as MODES from 'constants/file_render_modes';
import docxFixture from './fixtures/docx.cjs';
import { render, unmount, tick, waitFor } from './helpers';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

export default async function viewerLifecycle(store, history) {
  for (const failOld of [false, true]) {
    const old = deferred();
    const next = deferred();
    let instance;
    const show = (file) =>
      render(
        <DocumentViewer
          ref={(value) => {
            instance = value;
          }}
          theme="dark"
          renderMode={MODES.MARKDOWN}
          source={{ file, contentType: 'text/markdown' }}
        />,
        store,
        history
      );
    show(() => old.promise);
    await tick();
    show(() => next.promise);
    next.resolve(new TextEncoder().encode('# Current document'));
    await waitFor(() => document.querySelector('.markdown-preview h1'), 'Changed document source must render');
    if (failOld) old.reject(new Error('previous read failed'));
    else old.resolve(new TextEncoder().encode('# Previous document'));
    await tick();
    assert.equal(document.querySelector('.markdown-preview h1').textContent, 'Current document');
    assert.equal(instance.state.error, false, 'A previous read failure must not hide the current document');
    const pending = deferred();
    show(() => pending.promise);
    const detached = instance;
    unmount();
    pending.resolve(new TextEncoder().encode('# Closed document'));
    await tick();
    assert.equal(detached.state.content, null, 'A closed viewer must ignore its pending read');
  }

  const readDocument = desktop.readDocument;
  try {
    for (const failOld of [false, true]) {
      const old = deferred();
      const next = deferred();
      desktop.readDocument = (source) => (source === 'old.docx' ? old.promise : next.promise);
      render(<DocxViewer source="old.docx" />, store, history);
      render(<DocxViewer source="current.docx" />, store, history);
      const bytes = docxFixture().toBuffer();
      const padded = new Uint8Array(bytes.length + 14);
      padded.set(bytes, 7);
      next.resolve(padded.subarray(7, 7 + bytes.length));
      await waitFor(() => document.querySelector('.file-render__content h1'), 'DOCX path changes must reload');
      if (failOld) old.reject(new Error('previous read failed'));
      else old.resolve(new Uint8Array());
      await tick();
      await tick();
      assert.equal(document.querySelector('h1').textContent, 'Document fixture ł');
      assert(!document.body.textContent.includes("can't load the document"));
      unmount();
    }
    const pending = deferred();
    desktop.readDocument = () => pending.promise;
    let instance;
    render(
      <DocxViewer
        ref={(value) => {
          instance = value;
        }}
        source="pending.docx"
      />,
      store,
      history
    );
    const detached = instance;
    unmount();
    pending.reject(new Error('read after close'));
    await tick();
    assert.equal(detached.state.error, false, 'A closed DOCX viewer must ignore read errors');
  } finally {
    unmount();
    desktop.readDocument = readDocument;
  }

  let editorView;
  const showCode = (value, theme = 'dark', contentType = 'text/plain') =>
    render(
      <CodeViewer
        ref={(value) => {
          editorView = value;
        }}
        value={value}
        theme={theme}
        contentType={contentType}
      />,
      store,
      history
    );
  showCode('before import');
  showCode('after import', 'light', 'text/javascript');
  await waitFor(() => document.querySelector('.CodeMirror'), 'Code viewer must initialize');
  const editor = document.querySelector('.CodeMirror').CodeMirror;
  assert.equal(editor.getValue(), 'after import', 'Async editor initialization must use current props');
  assert.equal(editor.getOption('theme'), 'ttcn');
  assert.equal(editor.getOption('mode'), 'text/javascript');
  showCode('changed', 'dark', 'text/css');
  assert.equal(editor.getValue(), 'changed');
  assert.equal(editor.getOption('theme'), 'monokai');
  assert.equal(editor.getOption('mode'), 'text/css');
  let cleaned = 0;
  const cleanup = editor.toTextArea;
  editor.toTextArea = () => {
    cleaned++;
    cleanup();
  };
  unmount();
  assert.equal(cleaned, 1, 'Unmount must dispose the CodeMirror instance');
  showCode('closed before import');
  const detached = editorView;
  unmount();
  await tick();
  assert.equal(detached.codeMirror, null, 'A late chunk must not create an editor after unmount');
}
