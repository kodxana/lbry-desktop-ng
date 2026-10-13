import remark from 'remark';
import markdownRenderer from 'util/markdown-renderer';
import ReactDOMServer from 'react-dom/server';
import mammoth from 'mammoth';
import { PassThrough } from 'stream';
import { deprecate } from 'util';
import desktop from 'util/desktop';
import sanitizeDocumentHtml from 'util/document-html';

// Exercise browser compatibility code with no ambient Node globals. The fixture
// runner cannot catch a dependency accidentally relying on its own Node process.
window.probeDependencies = async (docx) => {
  const markdown = ReactDOMServer.renderToStaticMarkup(
    remark().use(markdownRenderer).processSync('# Sandbox ł\n\n**Bold**').contents
  );
  const bytes = await desktop.readDocument(docx);
  const document = await mammoth.convertToHtml(
    { arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) },
    { externalFileAccess: false }
  );
  const streamed = await new Promise((resolve, reject) => {
    const source = new PassThrough();
    const target = new PassThrough();
    const chunks = [];
    target.on('data', (chunk) => chunks.push(chunk));
    target.on('end', () => resolve(Buffer.concat(chunks).toString()));
    target.on('error', reject);
    source.pipe(target);
    source.end(Buffer.from('Browser stream ł'));
  });
  return {
    markdown,
    document: sanitizeDocumentHtml(document.value),
    streamed,
    deprecated: deprecate(() => 'supported', 'Fixture warning')(),
  };
};
