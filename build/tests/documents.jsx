import { strict as assert } from 'assert';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import desktop from 'util/desktop';
import { ipcRenderer } from 'electron';
import DocxViewer from 'component/viewers/docxViewer';
import DocumentViewer from 'component/viewers/documentViewer';
import PdfViewer from 'component/viewers/pdfViewer';
import HtmlViewer from 'component/viewers/htmlViewer';
import * as MODES from 'constants/file_render_modes';
import documentHtml from './documentHtml';
import pdfFixture from './fixtures/pdf.cjs';
import docxFixture from './fixtures/docx.cjs';
import markdown from './markdown';
import { render, unmount, waitFor } from './helpers';

export default async function documents(store, history, root) {
  markdown(store, history);
  documentHtml();
  for (const strict of [false, true]) {
    const source = path.join(root, `document ł #${strict ? 'strict' : 'transitional'}.docx`);
    docxFixture(strict).writeZip(source);
    await ipcRenderer.invoke('fixture-grant-file', source);
    render(<DocxViewer source={source} />, store, history);
    await waitFor(() => document.querySelector('.file-render__content'), 'DOCX conversion did not finish');
    assert.equal(document.querySelector('h1').textContent, 'Document fixture ł');
    assert.equal(document.querySelector('strong').textContent, 'Bold text');
    assert.equal(document.querySelector('td').textContent, 'Table cell');
    assert.equal(document.querySelector('ul li').textContent, 'List item');
    const content = document.querySelector('.file-render__content');
    assert(content.textContent.includes('Escaped & <literal> 文書'));
    assert(content.textContent.includes('Footnote text'));
    assert(content.textContent.includes('Moved revision'));
    assert(content.textContent.includes('Custom XML text'));
    assert(!content.textContent.includes('Old revision'));
    assert(!content.querySelector('a[href^="javascript:"]'), 'DOCX must not retain executable hyperlinks');
    assert(content.querySelector('a[href="https://example.invalid/document"]'));
    assert(content.querySelector('a[href="lbry://@fixture:abc/document:def"]'));
    assert(content.querySelector('a[href="lbry://@fixture#abc/document#def"]'));
    assert(content.querySelector('a[href="#user-content-section"]'), 'Internal links must retain their destination');
    assert.equal(content.querySelectorAll('a[href^="#"]').length, 3, 'Keep the bookmark and both footnote links');
    for (const anchor of content.querySelectorAll('a[href^="#"]')) {
      assert(document.getElementById(anchor.hash.slice(1)), 'Sanitized bookmarks and footnotes must resolve');
    }
    const image = content.querySelector('img');
    assert.equal(image.src, 'data:image/png;base64,' + docxFixture.png);
    assert.equal(image.alt, 'embedded');
    await waitFor(() => image.complete && image.naturalWidth === 1, 'Embedded DOCX image must decode');
    assert.equal(content.querySelectorAll('img').length, 1, 'Linked local and remote images must be omitted');
    unmount();
  }
  const noBody = docxFixture();
  noBody.updateFile(
    'word/document.xml',
    Buffer.from('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>')
  );
  for (const [name, bytes] of [
    ['corrupt', Buffer.from('Not a ZIP')],
    ['no-body', noBody.toBuffer()],
  ]) {
    const source = path.join(root, name + '.docx');
    fs.writeFileSync(source, bytes);
    await ipcRenderer.invoke('fixture-grant-file', source);
    render(<DocxViewer source={source} />, store, history);
    await waitFor(
      () => document.body.textContent.includes("can't load the document"),
      name + ' DOCX must show an error'
    );
    unmount();
  }

  let finish;
  const bytes = new Promise((resolve) => {
    finish = resolve;
  });
  render(
    <DocumentViewer
      theme="dark"
      renderMode={MODES.MARKDOWN}
      source={{ file: () => bytes, contentType: 'text/markdown' }}
    />,
    store,
    history
  );
  finish(
    new TextEncoder().encode(
      '# Markdown fixture\n\n**Bold** and [unsafe](javascript:void%280%29)\n\n<script>void(0)</script>'
    )
  );
  await waitFor(() => document.querySelector('.markdown-preview h1'), 'Chunked Markdown did not render');
  assert.equal(document.querySelector('strong').textContent, 'Bold');
  assert(!document.querySelector('.markdown-preview script, .markdown-preview a[href^="javascript:"]'));
  unmount();
  const textFile = path.join(root, 'plain ł.txt');
  fs.writeFileSync(textFile, '<script>literal text</script>\nZażółć gęślą');
  let code;
  await ipcRenderer.invoke('fixture-grant-file', textFile);
  const textSource = { file: () => desktop.readDocument(textFile), contentType: 'text/plain' };
  render(
    <DocumentViewer
      ref={(value) => {
        code = value;
      }}
      theme="dark"
      renderMode={MODES.PLAIN_TEXT}
      source={textSource}
    />,
    store,
    history
  );
  await waitFor(() => document.querySelector('.CodeMirror'), 'Plain text editor did not load');
  const editor = document.querySelector('.CodeMirror').CodeMirror;
  assert.equal(editor.getValue(), fs.readFileSync(textFile, 'utf8'));
  assert.equal(editor.getOption('readOnly'), true);
  assert.equal(editor.getOption('theme'), 'monokai');
  render(
    <DocumentViewer
      ref={(value) => {
        code = value;
      }}
      theme="light"
      renderMode={MODES.PLAIN_TEXT}
      source={textSource}
    />,
    store,
    history
  );
  assert.equal(editor.getOption('theme'), 'ttcn');
  assert(code);
  unmount();
  const missing = { file: () => desktop.readDocument(path.join(root, 'missing.txt')), contentType: 'text/plain' };
  render(<DocumentViewer theme="dark" renderMode={MODES.PLAIN_TEXT} source={missing} />, store, history);
  await waitFor(
    () => document.body.textContent.includes("can't load the document"),
    'Missing document must show an error'
  );
  unmount();

  // Electron 41 moved PDF rendering into out-of-process frames. Check the
  // rendered page, without depending on the built-in viewer's private DOM.
  const pdf = path.join(root, 'preview ł #1.pdf');
  fs.writeFileSync(pdf, pdfFixture());
  render(<PdfViewer source={pdf} />, store, history);
  const frame = document.querySelector('iframe');
  assert.equal(frame.src, pathToFileURL(pdf).href, 'Local document paths must preserve # and Unicode');
  frame.style.width = '600px';
  frame.style.height = '500px';
  await waitFor(
    async () => (await ipcRenderer.invoke('fixture-pdf-pixels')) > 1000,
    'The PDF viewer must paint the generated page, not just load an iframe URL'
  );
  unmount();
  const html = path.join(root, 'preview ł #1.html');
  fs.writeFileSync(html, '<!doctype html><h1>HTML fixture</h1><script>document.title="script-ran"</script>');
  render(<HtmlViewer source={html} />, store, history);
  assert.equal(document.querySelector('iframe').src, pathToFileURL(html).href);
  assert.equal(document.querySelector('iframe').getAttribute('sandbox'), '');
  await waitFor(() => !document.querySelector('iframe').hidden, 'Sandboxed HTML must become visible after loading');
  unmount();
  return 'DOCX formatting, LBRY links, images, footnotes, sanitizing/errors; Markdown formatting, timestamps, embeds/entities, text, PDF pixels and sandbox contracts';
}
