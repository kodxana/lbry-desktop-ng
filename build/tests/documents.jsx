import { strict as assert } from 'assert';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { PassThrough } from 'stream';
import AdmZip from 'adm-zip';
import { ipcRenderer } from 'electron';
import DocxViewer from 'component/viewers/docxViewer';
import DocumentViewer from 'component/viewers/documentViewer';
import PdfViewer from 'component/viewers/pdfViewer';
import HtmlViewer from 'component/viewers/htmlViewer';
import * as MODES from 'constants/file_render_modes';
import sanitizeDocumentHtml from 'util/document-html';
import pdfFixture from './fixtures/pdf.cjs';
import { render, unmount, waitFor } from './helpers';

export default async function documents(store, history, root) {
  const inert = document.createElement('template');
  inert.innerHTML = sanitizeDocumentHtml(
    '<script>void(0)</script><svg onload="void(0)"></svg><iframe src="file:///fixture"></iframe>' +
      '<a href="java&#x73;cript:void(0)" onclick="void(0)">unsafe</a>' +
      '<a href="file:///fixture">local</a><img src="file:///fixture" onerror="void(0)">' +
      '<img src="https://example.invalid/tracker"><img src="data:image/svg+xml;base64,PHN2Zy8+">' +
      '<img alt="embedded" src="data:image/png;base64,iVBORw0KGgo=">'
  );
  assert(
    !inert.content.querySelector('script, svg, iframe, [onclick], [onload], [onerror], a[href]'),
    'Document sanitizer must remove active content and unsafe links'
  );
  assert.equal(inert.content.querySelectorAll('img[src]').length, 1, 'Only embedded raster images may load');
  const source = path.join(root, 'document ł #1.docx');
  const zip = new AdmZip();
  zip.addFile(
    '[Content_Types].xml',
    Buffer.from(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    )
  );
  zip.addFile(
    '_rels/.rels',
    Buffer.from(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    )
  );
  zip.addFile(
    'word/document.xml',
    Buffer.from(
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' +
        '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Document fixture ł</w:t></w:r></w:p>' +
        '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Bold text</w:t></w:r></w:p>' +
        '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Table cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
        '<w:p><w:hyperlink r:id="unsafe"><w:r><w:t>Unsafe link</w:t></w:r></w:hyperlink></w:p>' +
        '<w:p><w:hyperlink r:id="safe"><w:r><w:t>Safe link</w:t></w:r></w:hyperlink></w:p>' +
        '</w:body></w:document>'
    )
  );
  zip.addFile(
    'word/styles.xml',
    Buffer.from(
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/></w:style></w:styles>'
    )
  );
  zip.addFile(
    'word/_rels/document.xml.rels',
    Buffer.from(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="unsafe" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="javascript:void(0)" TargetMode="External"/>' +
        '<Relationship Id="safe" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid/document" TargetMode="External"/>' +
        '</Relationships>'
    )
  );
  zip.writeZip(source);
  render(<DocxViewer source={source} />, store, history);
  await waitFor(() => document.querySelector('.file-render__content'), 'DOCX conversion did not finish');
  assert.equal(document.querySelector('h1').textContent, 'Document fixture ł');
  assert.equal(document.querySelector('strong').textContent, 'Bold text');
  assert.equal(document.querySelector('td').textContent, 'Table cell');
  assert(!document.querySelector('a[href^="javascript:"]'), 'DOCX must not retain executable hyperlinks');
  assert(document.querySelector('a[href="https://example.invalid/document"]'));
  unmount();
  const corrupt = path.join(root, 'corrupt.docx');
  fs.writeFileSync(corrupt, 'Not a ZIP');
  render(<DocxViewer source={corrupt} />, store, history);
  await waitFor(() => document.body.textContent.includes("can't load the document"), 'Corrupt DOCX must show an error');
  unmount();

  const stream = new PassThrough();
  render(
    <DocumentViewer
      theme="dark"
      renderMode={MODES.MARKDOWN}
      source={{ file: () => stream, contentType: 'text/markdown' }}
    />,
    store,
    history
  );
  stream.write('# Markdown fixture\n\n**Bold** and ');
  stream.end('[unsafe](javascript:void%280%29)\n\n<script>void(0)</script>');
  await waitFor(() => document.querySelector('.markdown-preview h1'), 'Chunked Markdown did not render');
  assert.equal(document.querySelector('strong').textContent, 'Bold');
  assert(!document.querySelector('.markdown-preview script, .markdown-preview a[href^="javascript:"]'));
  unmount();
  const textFile = path.join(root, 'plain ł.txt');
  fs.writeFileSync(textFile, '<script>literal text</script>\nZażółć gęślą');
  let code;
  const textSource = { file: (encoding) => fs.createReadStream(textFile, { encoding }), contentType: 'text/plain' };
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
  const missing = { file: () => fs.createReadStream(path.join(root, 'missing.txt')), contentType: 'text/plain' };
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
  return 'DOCX conversion/errors, Markdown sanitizing, read-only text/theme, PDF page pixels, document URL and sandbox contracts';
}
