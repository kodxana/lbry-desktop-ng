import browserAssert from 'assert';
import { PassThrough, Transform } from 'stream';
import { inherits } from 'util';
import { parse } from 'url/';
import { v4 as uuid } from 'uuid';

// This module is bundled into the sandbox fixture, with the production browser
// fallbacks. The main process independently checks its results using Node.
export default async function runtimeUtilities() {
  const backing = new Uint8Array([99, 0, 1, 127, 128, 254, 255, 88]);
  const view = backing.subarray(1, 7);
  const binary = Buffer.from(view.buffer, view.byteOffset, view.byteLength);
  const encoded = binary.toString('base64');
  const text = 'LBRY ł 🐦\0';
  const streamed = await new Promise((resolve, reject) => {
    const source = new PassThrough();
    const target = new PassThrough();
    const chunks = [];
    target.setEncoding('utf8');
    source.on('error', reject);
    target.on('error', reject);
    target.on('data', (chunk) => chunks.push(chunk));
    target.on('end', () => resolve(chunks.join('')));
    source.pipe(target);
    // Split every multibyte character across writes, as network chunks may do.
    for (const byte of Buffer.from(text)) source.write(Buffer.from([byte]));
    source.end();
  });
  const streamError = await new Promise((resolve) => {
    const broken = new Transform({
      transform(chunk, encoding, callback) {
        callback(new Error('Fixture stream failure'));
      },
    });
    broken.once('error', (error) => resolve(error.message));
    broken.resume();
    broken.end(Buffer.from('broken document'));
  });
  function Parent(value) {
    this.value = value;
  }
  function Child(value) {
    Parent.call(this, value);
  }
  inherits(Child, Parent);
  const child = new Child('inherited');
  let assertion;
  try {
    browserAssert.strictEqual(1, 2);
  } catch (error) {
    assertion = {
      recognized: error instanceof browserAssert.AssertionError,
      actual: error.actual,
      expected: error.expected,
    };
  }
  const url = parse('https://user:pass@example.org:8443/a%20b?q=hello#frag');
  return {
    encoded,
    decoded: Array.from(Buffer.from(encoded, 'base64')),
    utf8: Buffer.from(text).toString(),
    streamed,
    streamError,
    inheritance: { value: child.value, parent: child instanceof Parent, constructor: Child.super_ === Parent },
    assertion,
    url: {
      auth: url.auth,
      hostname: url.hostname,
      port: url.port,
      pathname: url.pathname,
      query: url.query,
      hash: url.hash,
    },
    ids: Array.from({ length: 64 }, () => uuid()),
  };
}
