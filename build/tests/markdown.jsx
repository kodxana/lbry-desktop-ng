import { strict as assert } from 'assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { remark } from 'remark';
import markdownRenderer from 'util/markdown-renderer';
import MarkdownPreview from 'component/common/markdown-preview';
import parserRegression from './markdownParser';
import { render, unmount, waitFor } from './helpers';

export default async function markdown(store, history) {
  parserRegression();
  const cases = [
    ['double quotes', '<iframe src="lbry://fixture"></iframe>', ['lbry://fixture']],
    ['single quotes', "<iframe src='lbry://fixture'></iframe>", ['lbry://fixture']],
    ['numeric entities', '<iframe src="lbry&#58;&#47;&#47;fixture"></iframe>', ['lbry://fixture']],
    ['named entities', '<iframe src="lbry&colon;&sol;&sol;fixture"></iframe>', ['lbry://fixture']],
    ['Unicode', '<iframe src="lbry://za%C5%BC%C3%B3%C5%82%C4%87"></iframe>', ['lbry://zażółć']],
    ['claim IDs', '<iframe src="lbry://@fixture#abc/video#def"></iframe>', ['lbry://@fixture#abc/video#def']],
    ['colon claim IDs', '[Video](lbry://@fixture:abc/video:def)', ['lbry://@fixture:abc/video:def']],
    ['whitespace', '<iframe\n src="lbry://fixture" ></iframe>', ['lbry://fixture']],
    ['extra attributes', '<iframe src="lbry://fixture" onload="void(0)"></iframe>', ['lbry://fixture']],
    [
      'multiple embeds',
      'Before\n\n<iframe src="lbry://first"></iframe>\n\n<iframe src="lbry://second"></iframe>\n\nAfter',
      ['lbry://first', 'lbry://second'],
    ],
    ['external frame', '<iframe src="https://example.invalid/frame"></iframe>', []],
    ['local frame', '<iframe src="file:///fixture.html"></iframe>', []],
    ['active source', '<iframe src="javascript:void(0)"></iframe>', []],
    ['empty source', '<iframe src=""></iframe>', []],
    ['missing closing tag', '<iframe src="lbry://fixture">', []],
    ['missing source', '<iframe></iframe>', []],
  ];
  for (const [name, content, embeds] of cases) {
    // The offline preview uses the same parser and remark chain without claim
    // resolution. No test should contact a hub or an embedded website.
    render(<MarkdownPreview content={content} noDataStore disableTimestamps />, store, history);
    const preview = document.querySelector('.markdown-preview');
    assert.deepEqual(
      Array.from(preview.querySelectorAll('.embed__inline-button--preview pre'), (node) => node.textContent),
      embeds,
      name
    );
    assert(!preview.querySelector('iframe, script, [onload], [onclick]'), name + ' must not create active HTML');
    if (name === 'multiple embeds') {
      assert(preview.textContent.startsWith('Before'));
      assert(preview.textContent.endsWith('After'));
    }
    unmount();
  }

  const content = [
    '---\ntitle: Hidden metadata\n---',
    '# Heading 文書',
    '**Bold** *Italic* ~~Removed~~ `literal <tag>`',
    '> Quoted',
    '3. Third\n4. Fourth',
    '- Bullet',
    '| Left | Right |\n| --- | --- |\n| One | Two |',
    'Line one\nLine two',
    '[External](https://example.invalid/document) and [Channel](lbry://@fixture)',
    'Seek 1:23 and 1:02:03. Invalid 62:01.',
    '[Unsafe](javascript:void%280%29) ![Local image](file:///fixture.png)',
    '<script>void(0)</script>',
  ].join('\n\n');
  render(<MarkdownPreview content={content} noDataStore />, store, history);
  const preview = document.querySelector('.markdown-preview');
  assert.equal(preview.querySelector('h1').textContent, 'Heading 文書');
  assert(!preview.textContent.includes('Hidden metadata'));
  assert.equal(preview.querySelector('strong').textContent, 'Bold');
  assert.equal(preview.querySelector('em').textContent, 'Italic');
  assert.equal(preview.querySelector('del').textContent, 'Removed');
  assert.equal(preview.querySelector('code').textContent, 'literal <tag>');
  assert.equal(preview.querySelector('blockquote').textContent.trim(), 'Quoted');
  assert.equal(preview.querySelector('ol').start, 3);
  assert.equal(preview.querySelector('ul li').textContent, 'Bullet');
  assert.deepEqual(
    Array.from(preview.querySelectorAll('td'), (node) => node.textContent),
    ['One', 'Two']
  );
  assert(preview.querySelector('br'), 'Single newlines must remain visible');
  assert(preview.querySelector('a[href="https://example.invalid/document"]'));
  assert(Array.from(preview.querySelectorAll('a')).some((node) => node.textContent === 'Channel'));
  assert(preview.querySelector('a[href="?t=83"]'));
  assert(preview.querySelector('a[href="?t=3723"]'));
  assert(!Array.from(preview.querySelectorAll('a')).some((node) => node.textContent === '62:01'));
  assert(!preview.querySelector('script, a[href^="javascript:"], img[src]'));
  unmount();
  for (const props of [{ disableTimestamps: true }, { isMarkdownPost: true }]) {
    render(<MarkdownPreview content="Seek 1:23" noDataStore {...props} />, store, history);
    assert(!document.querySelector('.markdown-preview a'));
    assert.equal(document.querySelector('.markdown-preview').textContent, 'Seek 1:23');
    unmount();
  }
  render(
    <MarkdownPreview content="**Bold** and [External](https://example.invalid)" noDataStore strip />,
    store,
    history
  );
  assert.equal(document.querySelector('.markdown-preview').textContent, 'Bold and External');
  assert(!document.querySelector('.markdown-preview strong, .markdown-preview a'));
  unmount();

  render(
    <MarkdownPreview
      content={
        '| Left | Centre | Right |\n| :--- | :---: | ---: |\n| One | Two | Three |\n\n- [x] Done\n- [ ] Pending\n\n```js\nconst text = "<tag>";\n```'
      }
      noDataStore
      disableTimestamps
    />,
    store,
    history
  );
  assert.deepEqual(
    Array.from(document.querySelectorAll('td'), (node) => node.style.textAlign),
    ['left', 'center', 'right']
  );
  assert.deepEqual(
    Array.from(document.querySelectorAll('input'), (node) => [node.checked, node.disabled]),
    [
      [true, true],
      [false, true],
    ]
  );
  assert.equal(document.querySelector('pre code').textContent, 'const text = "<tag>";\n');
  assert(!document.querySelector('pre tag'));
  unmount();

  // Serialize images without attaching them: the tests must not fetch CDN assets.
  const images = document.createElement('template');
  images.innerHTML = ReactDOMServer.renderToStaticMarkup(
    <MarkdownPreview
      content={'![Picture](https://example.invalid/picture.png "Caption")\n\n:ALIEN: :smile:'}
      noDataStore
    />
  );
  assert.equal(
    images.content.querySelector('img[alt="Picture"]').getAttribute('src'),
    'https://example.invalid/picture.png'
  );
  assert.equal(images.content.querySelector('img[alt="Picture"]').title, 'Caption');
  assert.equal(
    images.content.querySelector('img[title=":ALIEN:"]').getAttribute('src'),
    'https://static.odycdn.com/emoticons/48%20px/Alien%402x.png'
  );
  assert(images.content.textContent.includes('😄'), 'Standard emoji must still render');

  // Exercise the application link component too, including its single-child
  // contract. A labelled website link must not start claim resolution.
  for (const label of ['Read this', '**Read this**']) {
    const url = 'https://odysee.com/@fixture:abc/video:def';
    render(<MarkdownPreview content={'[' + label + '](' + url + ')'} />, store, history);
    const link = document.querySelector('.markdown-preview a');
    assert(link, 'A labelled website link must remain external');
    assert.equal(link.getAttribute('href'), url);
    assert(link.textContent.includes('Read this'));
    unmount();
  }
  const location = { ...history.location };
  render(<MarkdownPreview content="[Video](lbry://@fixture:abc/video:def)" simpleLinks />, store, history);
  const link = document.querySelector('.markdown-preview a');
  assert(link.getAttribute('href').includes('/@fixture:abc/video:def'));
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await waitFor(() => history.location.pathname === '/@fixture:abc/video:def', 'LBRY links must navigate in the app');
  unmount();
  history.replace(location);

  const previousPlayer = window.player;
  let seek;
  window.player = {
    get currentTime() {
      return seek;
    },
    set currentTime(value) {
      seek = value;
    },
  };
  try {
    render(<MarkdownPreview content="Seek 1:23" />, store, history);
    document.querySelector('.markdown-preview button').click();
    assert.equal(seek, 83, 'Timestamp clicks must reach the player');
    unmount();
  } finally {
    window.player = previousPlayer;
  }

  // Sanitization runs after plugins attach HTML properties and before React
  // creates elements. Test that boundary without broadening Markdown syntax.
  const unsafe = document.createElement('template');
  const result = remark()
    .use(function unsafeProperties() {
      return (tree) => {
        tree.children[0].data = {
          hName: 'a',
          hProperties: { href: 'javascript:void(0)', onClick: 'void(0)', style: 'display:none', id: 'location' },
        };
      };
    })
    .use(markdownRenderer)
    .processSync('Keep text').result;
  unsafe.innerHTML = ReactDOMServer.renderToStaticMarkup(result);
  assert.equal(unsafe.content.textContent, 'Keep text');
  assert(!unsafe.content.querySelector('[href], [onclick], [style]'));
  assert.equal(unsafe.content.querySelector('a').id, 'user-content-location');
}
