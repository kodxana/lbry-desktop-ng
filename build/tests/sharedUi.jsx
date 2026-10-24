import { strict as assert } from 'assert';
import React from 'react';
import Icon from 'component/common/icon';
import CreditAmount from 'component/common/credit-amount';
import { icons } from 'component/common/icon-custom';
import * as ICONS from 'constants/icons';
import { FREE_GLOBAL_STICKERS, PAID_GLOBAL_STICKERS } from 'constants/stickers';
import { render, unmount } from './helpers';

export default function sharedUi(store, history) {
  render(
    <div>
      {Object.entries(icons).map(([name, SvgIcon]) => (
        <span key={name} data-fixture-icon={name}>
          <SvgIcon />
        </span>
      ))}
    </div>,
    store,
    history
  );
  const rendered = document.querySelectorAll('[data-fixture-icon]');
  assert.equal(rendered.length, Object.keys(icons).length);
  for (const element of rendered) {
    assert(element.querySelector('svg'), 'Icon must render an SVG: ' + element.dataset.fixtureIcon);
  }
  unmount();

  const Lock = icons[ICONS.LOCK];
  const ref = React.createRef();
  render(<Lock ref={ref} title="Wallet lock" />, store, history);
  assert(ref.current instanceof SVGSVGElement, 'Standard icons must forward their DOM ref');
  assert.equal(ref.current.getAttribute('width'), '24');
  assert.equal(ref.current.getAttribute('stroke'), 'currentColor');
  assert.equal(ref.current.querySelector('title').textContent, 'Wallet lock');
  render(<Lock ref={ref} size={32} color="#123456" title={null} />, store, history);
  assert.equal(ref.current.getAttribute('width'), '32');
  assert.equal(ref.current.getAttribute('stroke'), '#123456');
  assert.equal(ref.current.querySelector('title'), null);
  unmount();
  assert.equal(ref.current, null);

  render(
    <>
      <Icon icon={ICONS.LOCK} sectionIcon tooltip customTooltipText="Locked wallet" iconColor="red" />
      <Icon icon="fixture-unknown-icon" />
    </>,
    store,
    history
  );
  assert.equal(document.querySelectorAll('#app svg').length, 1, 'Unknown icons must keep rendering nothing');
  const section = document.querySelector('.icon__wrapper svg');
  assert.equal(section.getAttribute('width'), '20');
  assert.equal(section.getAttribute('stroke'), '#e2495e');
  assert.equal(section.querySelector('title').textContent, 'Locked wallet');
  unmount();

  const language = localStorage.getItem('language');
  localStorage.setItem('language', 'en');
  try {
    render(<CreditAmount amount={0.00000001} />, store, history);
    assert.equal(document.querySelector('.credit-amount').textContent, '<0.01');
    assert(document.querySelector('.credit-amount svg'), 'Tiny amounts keep the LBC symbol');
    render(<CreditAmount amount={12.5} isFiat />, store, history);
    assert.equal(document.querySelector('.credit-amount').textContent.trim(), '$12.50');
    render(<CreditAmount amount={12.5} showPlus showLBC={false} />, store, history);
    assert.equal(document.querySelector('.credit-amount').textContent, '+12.50');
    render(<CreditAmount amount={0.00000001} noFormat showLBC={false} />, store, history);
    assert.equal(document.querySelector('.credit-amount').textContent, '1e-8');
    render(<CreditAmount />, store, history);
    assert.equal(document.querySelector('#app').textContent, '');
  } finally {
    unmount();
    if (language === null) localStorage.removeItem('language');
    else localStorage.setItem('language', language);
  }

  const stickers = [...FREE_GLOBAL_STICKERS, ...PAID_GLOBAL_STICKERS];
  assert(FREE_GLOBAL_STICKERS.length > 0 && PAID_GLOBAL_STICKERS.length > 0);
  assert.equal(new Set(stickers.map(({ name }) => name)).size, stickers.length);
  for (const sticker of stickers) {
    assert.match(sticker.name, /^:[A-Z0-9_]+:$/);
    const url = new URL(sticker.url);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'static.odycdn.com');
    assert(url.pathname.startsWith('/stickers/'));
  }
  assert(FREE_GLOBAL_STICKERS.every(({ price }) => price === undefined));
  assert(PAID_GLOBAL_STICKERS.every(({ price }) => typeof price === 'number' && Number.isFinite(price) && price > 0));
}
