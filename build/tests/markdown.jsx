import { strict as assert } from 'assert';
import React from 'react';
import MarkdownPreview from 'component/common/markdown-preview';
import { render, unmount } from './helpers';

export default function markdown(store, history) {
  const cases = [
    ['double quotes', '<iframe src="lbry://fixture"></iframe>', ['lbry://fixture']],
    ['single quotes', "<iframe src='lbry://fixture'></iframe>", ['lbry://fixture']],
    ['numeric entities', '<iframe src="lbry&#58;&#47;&#47;fixture"></iframe>', ['lbry://fixture']],
    ['named entities', '<iframe src="lbry&colon;&sol;&sol;fixture"></iframe>', ['lbry://fixture']],
    ['Unicode', '<iframe src="lbry://za%C5%BC%C3%B3%C5%82%C4%87"></iframe>', ['lbry://zażółć']],
    ['claim IDs', '<iframe src="lbry://@fixture#abc/video#def"></iframe>', ['lbry://@fixture#abc/video#def']],
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
}
