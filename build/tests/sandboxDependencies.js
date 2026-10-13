import remark from 'remark';
import reactRenderer from 'remark-react';
import ReactDOMServer from 'react-dom/server';
import mammoth from 'mammoth';
import { PassThrough } from 'stream';
import { deprecate } from 'util';
import desktop from 'util/desktop';

// Exercise browser compatibility code with no ambient Node globals. The fixture
// runner cannot catch a dependency accidentally relying on its own Node process.
window.probeDependencies = async (docx) => {
  const markdown = ReactDOMServer.renderToStaticMarkup(
    remark().use(reactRenderer).processSync('# Sandbox ł\n\n**Bold**').contents
  );
  const bytes = await desktop.readDocument(docx);
  const document = await mammoth.convertToHtml({
    arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
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
    document: document.value,
    streamed,
    deprecated: deprecate(() => 'supported', 'Fixture warning')(),
  };
};
