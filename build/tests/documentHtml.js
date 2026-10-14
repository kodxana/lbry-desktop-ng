import { strict as assert } from 'assert';
import sanitizeDocumentHtml from 'util/document-html';

function clean(html) {
  const template = document.createElement('template');
  template.innerHTML = sanitizeDocumentHtml(html);
  return template.content;
}

export default function documentHtml() {
  const content = clean(
    '<h2 id="section" title="Heading">Zażółć &amp; 文書</h2>' +
      '<p><strong>Bold</strong> <em>Italic</em> <del>Removed</del> <code>&lt;literal&gt;</code></p>' +
      '<blockquote><p>Quoted</p></blockquote><ol start="3"><li>Third</li></ol><ul><li>Bullet</li></ul>' +
      '<table><thead><tr><th colspan="2">Heading</th></tr></thead>' +
      '<tbody><tr><td rowspan="2">Cell</td><td>Other</td></tr><tr><td>Last</td></tr></tbody></table>' +
      '<a href="#section">Bookmark</a><sup><a id="ref-1" href="#note-1">1</a></sup>' +
      '<ol><li id="note-1">Footnote <a href="#ref-1">Back</a></li></ol>' +
      '<figure><figcaption>Caption</figcaption></figure><p><mark>Marked</mark> <abbr title="Abbreviation">Abbr</abbr></p>'
  );
  assert.equal(content.querySelector('h2').textContent, 'Zażółć & 文書');
  assert.equal(content.querySelector('h2').title, 'Heading');
  for (const [tag, text] of [
    ['strong', 'Bold'],
    ['em', 'Italic'],
    ['del', 'Removed'],
    ['code', '<literal>'],
  ]) {
    assert.equal(content.querySelector(tag).textContent, text);
  }
  assert.equal(content.querySelector('blockquote p').textContent, 'Quoted');
  assert.equal(content.querySelector('ol').start, 3);
  assert.equal(content.querySelector('ul li').textContent, 'Bullet');
  assert.equal(content.querySelector('th').colSpan, 2);
  assert.equal(content.querySelector('td').rowSpan, 2);
  assert.equal(content.querySelector('figure figcaption').textContent, 'Caption');
  assert.equal(content.querySelector('mark').textContent, 'Marked');
  assert.equal(content.querySelector('abbr').title, 'Abbreviation');
  for (const anchor of content.querySelectorAll('a[href^="#"]')) {
    assert(content.getElementById(anchor.hash.slice(1)), 'Bookmarks and both footnote directions must resolve');
  }

  for (const href of [
    'https://example.invalid/doc',
    'http://example.invalid/doc',
    'mailto:fixture@example.invalid',
    'lbry://@fixture#abc/document#def',
    'lbry://@fixture:abc/document:def',
    'lbry://document:def',
  ]) {
    assert.equal(
      clean('<a href="' + href + '">Link</a>')
        .querySelector('a')
        .getAttribute('href'),
      href
    );
  }
  assert.equal(
    clean('<a href="LBRY://@fixture:abc/document:def">Channel</a>').querySelector('a').getAttribute('href'),
    'lbry://@fixture:abc/document:def'
  );
  for (const href of [
    'javascript:void(0)',
    'java&#x73;cript:void(0)',
    'java&#9;script:void(0)',
    'data:text/html,fixture',
    'file:///fixture',
    'C:/fixture',
    '//example.invalid/doc',
    '/fixture',
    '../fixture',
    '?fixture',
  ]) {
    const link = clean('<a href="' + href + '">Keep text</a>').querySelector('a');
    assert(!link.hasAttribute('href'), 'Disallowed document URL: ' + href);
    assert.equal(link.textContent, 'Keep text');
  }

  for (const format of ['png', 'jpeg', 'gif', 'webp']) {
    const src = 'data:image/' + format + ';base64,iVBORw0KGgo=';
    const img = clean('<img alt="Embedded" src="' + src + '">').querySelector('img');
    assert.equal(img.getAttribute('src'), src);
    assert.equal(img.alt, 'Embedded');
  }
  for (const src of [
    'file:///fixture',
    'https://example.invalid/tracker',
    '//example.invalid/tracker',
    '../fixture.png',
    'data:image/svg+xml;base64,PHN2Zy8+',
    'data:text/html;base64,PGgxPg==',
    'data:image/png;base64,invalid!',
  ]) {
    assert(
      !clean('<img src="' + src + '">')
        .querySelector('img')
        .hasAttribute('src'),
      src
    );
  }
  const unsafe = clean(
    '<script>script-content</script><svg onload="void(0)"></svg><iframe src="file:///fixture"></iframe>' +
      '<form action="https://example.invalid"><input name="wallet" value="fixture"></form>' +
      '<object data="file:///fixture"></object><style>body { color: red }</style>' +
      '<a href="https://example.invalid" onclick="void(0)" style="display:none">Visible</a>' +
      '<picture><source srcset="https://example.invalid/tracker 2x">' +
      '<img srcset="https://example.invalid/tracker 2x" onerror="void(0)"></picture>' +
      '<p id="location" name="location">Text</p><custom-element><strong>Keep children</strong></custom-element>'
  );
  assert(
    !unsafe.querySelector(
      'script, svg, iframe, form, object, style, [onclick], [onload], [onerror], [srcset], [style], [name], [value]'
    )
  );
  assert(!unsafe.textContent.includes('script-content'));
  assert.equal(unsafe.querySelector('input').type, 'checkbox');
  assert.equal(unsafe.querySelector('input').disabled, true);
  assert.equal(unsafe.querySelector('p').id, 'user-content-location');
  assert.equal(unsafe.querySelector('strong').textContent, 'Keep children');
}
