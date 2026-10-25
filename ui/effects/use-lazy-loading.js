// @flow
import React, { useEffect } from 'react';

/**
 * Helper React hook for lazy loading images
 * @param elementRef - A React useRef instance to the element to lazy load.
 * @param backgroundFallback
 * @param yOffsetPx - Number of pixels from the viewport to start loading.
 * @param {Array<>} [deps=[]] - The dependencies this lazy-load is reliant on.
 */
export default function useLazyLoading(
  elementRef: Readonly<{ current: HTMLElement | null }>,
  backgroundFallback: string = '',
  yOffsetPx: number = 500,
  deps: Array<unknown> = []
): boolean {
  const [srcLoaded, setSrcLoaded] = React.useState(false);
  const threshold = 0.01;

  function calcRootMargin(value: number): number {
    const devicePixelRatio = window.devicePixelRatio || 1.0;
    if (devicePixelRatio < 1.0) {
      return Math.ceil(value / devicePixelRatio);
    }
    return Math.ceil(value * devicePixelRatio);
  }

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    let active = true;
    let fallbackImage: HTMLImageElement | null = null;
    setSrcLoaded(false);
    const lazyLoadingObserver = new IntersectionObserver(
      (entries, observer) => {
        if (!active) return;
        entries.forEach((entry) => {
          if (entry.intersectionRatio >= threshold) {
            const { target } = entry;
            if (!(target instanceof HTMLElement)) return;

            observer.unobserve(target);

            // useful for lazy loading img tags
            if (target instanceof HTMLImageElement && target.dataset.src) {
              target.src = target.dataset.src;
              setSrcLoaded(true);
              // No fallback handling here (clients have access to 'onerror' on the image ref).
              return;
            }

            // useful for lazy loading background images on divs
            const background = target.dataset.backgroundImage;
            if (background) {
              if (backgroundFallback) {
                const tmpImage = new Image();
                fallbackImage = tmpImage;
                tmpImage.onerror = () => {
                  if (active) target.style.backgroundImage = `url(${backgroundFallback})`;
                };
                tmpImage.src = background;
              }
              target.style.backgroundImage = `url(${background})`;
            }
          }
        });
      },
      {
        root: null,
        rootMargin: `0px 0px ${calcRootMargin(yOffsetPx)}px 0px`,
        threshold: [threshold],
      }
    );

    lazyLoadingObserver.observe(element);
    return () => {
      active = false;
      lazyLoadingObserver.disconnect();
      if (fallbackImage) fallbackImage.onerror = null;
    };
  }, deps);

  return srcLoaded;
}
