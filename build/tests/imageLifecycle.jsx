import { strict as assert } from 'assert';
import React from 'react';
import PropTypes from 'prop-types';
import useLazyLoading from 'effects/use-lazy-loading';
import imageUrl from './fixtures/build-probe.svg';
import { render, unmount, waitFor } from './helpers';

function ImageFixture({ source, background = false }) {
  const ref = React.useRef(null);
  const loaded = useLazyLoading(ref, imageUrl, 500, [source, background]);
  return background ? (
    <div ref={ref} data-background-image={source} />
  ) : (
    <img ref={ref} data-src={source} data-loaded={String(loaded)} alt="fixture" />
  );
}
ImageFixture.propTypes = { source: PropTypes.string.isRequired, background: PropTypes.bool };

export default async function imageLifecycle(store, history) {
  const OriginalObserver = window.IntersectionObserver;
  const OriginalImage = window.Image;
  const observers = [];
  const images = [];
  window.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe(target) {
      this.target = target;
    }
    unobserve(target) {
      assert.equal(target, this.target);
      this.unobserved = true;
    }
    disconnect() {
      this.disconnected = true;
    }
    enter() {
      this.callback([{ target: this.target, intersectionRatio: 1 }], this);
    }
  };
  window.Image = function () {
    const image = new OriginalImage();
    images.push(image);
    return image;
  };
  try {
    render(<ImageFixture source={imageUrl} />, store, history);
    const first = observers[0];
    assert(!first.target.getAttribute('src'), 'Images stay deferred until visible');
    first.enter();
    await waitFor(() => first.target.dataset.loaded === 'true', 'Visible images must finish the loading state');
    assert.equal(first.target.src, new URL(imageUrl, location.href).href);
    assert.equal(first.target.dataset.loaded, 'true');
    assert(first.unobserved);
    const nextUrl = imageUrl + '?next';
    render(<ImageFixture source={nextUrl} />, store, history);
    const next = observers[1];
    assert(first.disconnected, 'Source changes must disconnect the old observer');
    await waitFor(() => next.target.dataset.loaded === 'false', 'Source changes must reset the loading state');
    first.enter();
    assert.notEqual(
      next.target.src,
      new URL(nextUrl, location.href).href,
      'An old callback must not load a new source'
    );
    next.enter();
    await waitFor(() => next.target.dataset.loaded === 'true', 'The new source must become loaded');
    assert.equal(next.target.src, new URL(nextUrl, location.href).href);
    const detached = next.target;
    unmount();
    assert(next.disconnected);
    detached.dataset.src = 'about:blank';
    next.enter();
    assert.notEqual(detached.src, 'about:blank', 'Callbacks after unmount must do nothing');

    render(<ImageFixture source={imageUrl + '?background'} background />, store, history);
    const background = observers[2];
    background.enter();
    assert(background.target.style.backgroundImage.includes('?background'));
    const error = images[0].onerror;
    error();
    assert(
      !background.target.style.backgroundImage.includes('?background'),
      'Failed backgrounds must use the fallback'
    );
    render(<ImageFixture source={nextUrl} background />, store, history);
    observers[3].enter();
    error();
    assert(
      background.target.style.backgroundImage.includes('?next'),
      'An old error must not replace the new background'
    );
    assert.equal(images[0].onerror, null);
    const finalError = images[1].onerror;
    unmount();
    assert.equal(images[1].onerror, null);
    finalError();
    assert(background.target.style.backgroundImage.includes('?next'));
  } finally {
    unmount();
    window.IntersectionObserver = OriginalObserver;
    window.Image = OriginalImage;
  }
}
