import { strict as assert } from 'assert';
import ReactDOMServer from 'react-dom/server';
import markdownProcessor from 'util/markdown-processor';
import markdownRenderer from 'util/markdown-renderer';

// Render the production parser/compiler into an inert document: images and
// links can be inspected without contacting a hub, CDN or website.
function preview(content, options) {
  const template = document.createElement('template');
  template.innerHTML = ReactDOMServer.renderToStaticMarkup(
    markdownProcessor(options).use(markdownRenderer).processSync(content).result
  );
  return template.content;
}

export default function parserRegression() {
  const links = [
    ['lbry://video', 'lbry://video', 'lbry://video'],
    ['lbry://@channel', 'lbry://@channel', '@channel'],
    ['@channel', 'lbry://@channel', '@channel'],
    ['@channel:abc', 'lbry://@channel:abc', '@channel'],
    ['@channel#abc', 'lbry://@channel#abc', '@channel'],
    ['lbry://@channel:abc/video:def.', 'lbry://@channel:abc/video:def', 'lbry://@channel:abc/video:def'],
    ['lbry://@channel#abc/video#def!', 'lbry://@channel#abc/video#def', 'lbry://@channel#abc/video#def'],
    ['(lbry://video)', 'lbry://video', 'lbry://video'],
    ['lbry://a_b', 'lbry://a_b', 'lbry://a_b'],
    ['@a-b', 'lbry://@a-b', '@a-b'],
    ['@a_b', 'lbry://@a_b', '@a_b'],
    ['[Label](lbry://video)', 'lbry://video', 'Label'],
    ['<lbry://video>', 'lbry://video', 'lbry://video'],
    ['[Label][ref]\n\n[ref]: lbry://video', 'lbry://video', 'Label'],
    ['**@channel**', 'lbry://@channel', '@channel'],
    ['_@channel_', 'lbry://@channel', '@channel'],
    ['~~@channel~~', 'lbry://@channel', '@channel'],
    ['__lbry://a_b__', 'lbry://a_b', 'lbry://a_b'],
  ];
  for (const [input, href, label] of links) {
    const document = preview(input);
    assert.equal(document.querySelectorAll('a').length, 1, input);
    assert.equal(document.querySelector('a').getAttribute('href'), href, input);
    assert.equal(document.querySelector('a').textContent, label, input);
  }
  assert(preview('**@channel**').querySelector('strong a'));
  assert(preview('_@channel_').querySelector('em a'));
  assert(preview('~~@channel~~').querySelector('del a'));
  assert.equal(preview('(lbry://video)').textContent, '(lbry://video)');
  assert.equal(preview('\\:alien: \\:smile: &#58;alien: &#58;smile:').textContent, ':alien: :smile: :alien: :smile:');

  for (const input of [
    'before@channel xlbry://video',
    '\\@channel \\:ALIEN: 1\\:23',
    '&#64;channel &#58;ALIEN: 1&#58;23',
    '`lbry://video @channel 1:23 :ALIEN:`',
    '```\nlbry://video @channel 1:23 :ALIEN:\n```',
    'lbry:// @ @channel:xyz',
  ]) {
    const document = preview(input);
    assert(!document.querySelector('a, img'), 'Must remain literal: ' + input);
  }
  const labelled = preview('[lbry://video @channel 1:23 :ALIEN:](https://example.invalid)');
  assert.equal(labelled.querySelectorAll('a').length, 1);
  assert(!labelled.querySelector('img'));
  assert.equal(labelled.querySelector('a').textContent, 'lbry://video @channel 1:23 :ALIEN:');
  const external = preview('https://example.invalid/1:23/@channel www.example.invalid a@b.com');
  assert.deepEqual(
    Array.from(external.querySelectorAll('a'), (a) => a.getAttribute('href')),
    ['https://example.invalid/1:23/@channel', 'http://www.example.invalid', 'mailto:a@b.com']
  );

  const timestamps = preview('0:12: Start. 1:23 1:02:03 59:59 9:59:59 99:59:59 62:01 1:60 100:00:00');
  assert.deepEqual(
    Array.from(timestamps.querySelectorAll('a'), (a) => a.getAttribute('href')),
    ['?t=12', '?t=83', '?t=3723', '?t=3599', '?t=35999', '?t=359999']
  );
  assert(timestamps.textContent.startsWith('0:12: Start.'));
  for (const input of ['- 1:23', '> 1:23', '# 1:23', '**1:23**', '| Time |\n| --- |\n| 1:23 |']) {
    assert(!preview(input).querySelector('a'), 'Timestamp scope: ' + input);
  }
  assert(!preview('1:23', { disableTimestamps: true }).querySelector('a'));

  const emotes = preview(':ALIEN: :alien: :smile: :unknown: :+1: :-1:');
  assert.equal(emotes.querySelectorAll('img').length, 2);
  assert(
    Array.from(emotes.querySelectorAll('img')).every((img) => img.getAttribute('src').endsWith('/Alien%402x.png'))
  );
  assert(emotes.textContent.includes('😄 :unknown: 👍 👎'));
  for (const input of ['# :ALIEN:', '**:ALIEN:**', '[Label :ALIEN:](https://example.invalid)', '**:alien:**']) {
    assert(!preview(input).querySelector('img'), 'Emote scope: ' + input);
    assert(preview(input).textContent.includes(':ALIEN:') || preview(input).textContent.includes(':alien:'));
  }
  assert.equal(preview('**:smile:**').querySelector('strong').textContent, '😄');

  const processor = markdownProcessor();
  for (const [suffix, embed] of [
    ['', true],
    ['{embed}', ''],
    ['{embed=""}', ''],
    ['{embed=false}', 'false'],
  ]) {
    const input = '[Video](lbry://video)' + suffix;
    const tree = processor.runSync(processor.parse(input));
    assert.equal(tree.children[0].children[0].data.hProperties.embed, embed, input);
    assert(!preview(input).textContent.includes('{'), input);
  }
  const attributes = preview(
    '![Image](https://example.invalid/a.png){width=50 height=20 title="A **literal** caption"}'
  );
  const img = attributes.querySelector('img');
  assert.equal(img.getAttribute('width'), '50');
  assert.equal(img.getAttribute('height'), '20');
  assert.equal(img.title, 'A **literal** caption');
  assert.equal(preview('![Image](https://example.invalid/a.png){width=50\theight=20}').querySelector('img').height, 20);
  assert.equal(preview('[Text](https://example.invalid){title="A } brace"}').querySelector('a').title, 'A } brace');
  for (const suffix of [' {embed}', '\\{embed}', '{embed="unfinished}', '{embed\n}']) {
    assert(
      preview('[Video](lbry://video)' + suffix).textContent.includes('{'),
      'Invalid/separated attributes: ' + suffix
    );
  }
  assert.equal(preview('{**ordinary text**}').querySelector('strong').textContent, 'ordinary text');
  const unsafe = preview(
    '[Text](https://example.invalid){href="javascript:alert(1)" onclick="alert(1)" style="display:none" id=location}'
  );
  assert.equal(unsafe.textContent, 'Text');
  assert(!unsafe.querySelector('[href], [onclick], [style]'));
  assert.equal(unsafe.querySelector('a').id, 'user-content-location');

  const stripped = preview('---\ntitle: hidden\n---\n\n# **Heading**\n\n[Text](lbry://video) and `code`', {
    strip: true,
  });
  assert.equal(stripped.textContent.trim(), 'Heading\nText and code');
  assert(!stripped.querySelector('a, h1, strong, code'));
  assert.equal(preview('~literal~ ~~deleted~~').querySelectorAll('del').length, 1);
  assert(!preview('Note[^n]\n\n[^n]: Text').querySelector('section[data-footnotes]'));
  assert.equal(preview('').textContent, '');
}
