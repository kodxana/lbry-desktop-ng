// @flow
import React from 'react';
import debounce from 'util/debounce';

const DEBOUNCE_SCROLL_HANDLER_MS = 50;

function scaleToDevicePixelRatio(value: number): number {
  const devicePixelRatio = window.devicePixelRatio || 1.0;
  if (devicePixelRatio < 1.0) {
    return Math.ceil(value / devicePixelRatio);
  }
  return Math.ceil(value * devicePixelRatio);
}

type Props = {
  children: any,
  skipWait?: boolean,
  placeholder?: any,
  yOffset?: number,
};

export default function WaitUntilOnPage(props: Props): React.Node {
  const { yOffset } = props;
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = React.useState(false);

  const shouldElementRender = React.useCallback(
    (ref: { current: HTMLDivElement | null }) => {
      const element = ref && ref.current;
      if (element) {
        const bounding = element.getBoundingClientRect();
        const windowH = window.innerHeight || document.documentElement?.clientHeight || 0;
        const windowW = window.innerWidth || document.documentElement?.clientWidth || 0;

        const isApproachingViewport = yOffset && bounding.top < windowH + scaleToDevicePixelRatio(yOffset);
        const isInViewport = // also covers "element is larger than viewport".
          bounding.width > 0 &&
          bounding.height > 0 &&
          bounding.bottom >= 0 &&
          bounding.right >= 0 &&
          bounding.top <= windowH &&
          bounding.left <= windowW;

        return isInViewport || isApproachingViewport;
      }

      return false;
    },
    [yOffset]
  );

  // Handles "element is already in viewport when mounted".
  React.useEffect(() => {
    setTimeout(() => {
      if (!shouldRender && shouldElementRender(ref)) {
        setShouldRender(true);
      }
    }, 500);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handles "element scrolled into viewport".
  React.useEffect(() => {
    const handleDisplayingRef = debounce(() => {
      if (shouldElementRender(ref)) {
        setShouldRender(true);
      }
    }, DEBOUNCE_SCROLL_HANDLER_MS);

    if (ref && ref.current && !shouldRender) {
      window.addEventListener('scroll', handleDisplayingRef);
      window.addEventListener('resize', handleDisplayingRef);
      return () => {
        window.removeEventListener('scroll', handleDisplayingRef);
        window.removeEventListener('resize', handleDisplayingRef);
      };
    }
  }, [ref, setShouldRender, shouldRender, shouldElementRender]);

  const render = props.skipWait || shouldRender;

  return (
    <div ref={ref}>
      {render && props.children}
      {!render && props.placeholder !== undefined && props.placeholder}
    </div>
  );
}
