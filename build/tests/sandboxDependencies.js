import 'core-js/stable';
import 'regenerator-runtime/runtime';
import markdownProcessor from 'util/markdown-processor';
import markdownRenderer from 'util/markdown-renderer';
import ReactDOMServer from 'react-dom/server';
import React from 'react';
import { readComic } from 'util/comic-archive';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import ThreeViewer from 'component/viewers/threeViewer';
import mammoth from 'mammoth';
import { PassThrough } from 'stream';
import { deprecate } from 'util';
import desktop from 'util/desktop';
import sanitizeDocumentHtml from 'util/document-html';
import ElectronCookies from 'util/electron-cookies.cjs';
import legacyCookies from './fixtures/legacy-cookies.json';
import runtimeUtilities from './runtimeUtilities';

window.probeComic = async (filename) => {
  const urls = await readComic(await desktop.readDocument(filename), new AbortController().signal);
  try {
    const image = new Image();
    image.src = urls[0];
    await image.decode();
    return { pages: urls.length, width: image.naturalWidth, node: typeof window.require };
  } finally {
    urls.forEach((url) => URL.revokeObjectURL(url));
  }
};

window.probeThree = async (filename) => {
  const container = document.createElement('div');
  const store = createStore(() => ({ settings: { clientSettings: { theme: 'dark' } } }));
  document.body.append(container);
  window.__ = (text) => text;
  let viewer;
  const root = createRoot(container);
  try {
    root.render(
      React.createElement(
        Provider,
        { store },
        React.createElement(ThreeViewer, {
          ref: (value) => {
            viewer = value;
          },
          source: { fileType: 'stl', downloadPath: filename },
        })
      )
    );
    for (let count = 0; count < 200; count++) {
      if (viewer && (viewer.state.isReady || viewer.state.error)) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (!viewer || !viewer.state.isReady) throw new Error((viewer && viewer.state.error) || 'Sandbox model timed out');
    viewer.renderer.render(viewer.scene, viewer.camera);
    return {
      node: typeof window.require,
      webgl2: viewer.renderer.getContext() instanceof WebGL2RenderingContext,
      triangles: viewer.renderer.info.render.triangles,
      vertices: viewer.mesh.geometry.getAttribute('position').count,
    };
  } finally {
    root.unmount();
    container.remove();
  }
};

// Exercise browser compatibility code with no ambient Node globals. The fixture
// runner cannot catch a dependency accidentally relying on its own Node process.
window.probeDependencies = async (docx) => {
  localStorage.setItem('__cookieStore__', JSON.stringify(legacyCookies));
  ElectronCookies.enable({ url: 'https://lbry.tv/' });
  const legacyCookie = window.document.cookie;
  window.document.cookie = 'sandbox_cookie=roundtrip-%20=value; Path=/; Secure';
  ElectronCookies.disable();
  ElectronCookies.enable({ url: 'https://lbry.tv/' });
  const persistedCookie = window.document.cookie;
  ElectronCookies.disable();
  const mappedPath = '/C:/Users/fixture/LBRY%20Desktop%20NG/resources/app.asar';
  const mappedCookies = {
    'lbry.tv': {
      [mappedPath]: {
        old_path: {
          ...legacyCookies['lbry.tv']['/'].unrelated_cookie,
          key: 'old_path',
          value: 'preserve-path',
          path: mappedPath,
        },
      },
    },
  };
  localStorage.setItem('__cookieStore__', JSON.stringify(mappedCookies));
  ElectronCookies.enable({
    url: 'https://lbry.tv/C:%5CUsers%5Cfixture%5CLBRY%20Desktop%20NG%5Cresources%5Capp.asar%5Cindex.html',
  });
  const mappedCookie = window.document.cookie;
  window.document.cookie = 'new_path=preserve-path';
  const mappedCookiePath = JSON.parse(localStorage.getItem('__cookieStore__'))['lbry.tv'][mappedPath].new_path.path;
  ElectronCookies.disable();
  const markdown = ReactDOMServer.renderToStaticMarkup(
    markdownProcessor().use(markdownRenderer).processSync('# Sandbox ł\n\n**Bold**').result
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
    utilities: await runtimeUtilities(),
    legacyCookie,
    persistedCookie,
    mappedCookie,
    mappedCookiePath,
    markdown,
    document: sanitizeDocumentHtml(document.value),
    streamed,
    deprecated: deprecate(() => 'supported', 'Fixture warning')(),
  };
};
