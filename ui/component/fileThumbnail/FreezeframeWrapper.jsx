// @flow
import React, { useEffect } from 'react';
import classnames from 'classnames';
import Freezeframe from './FreezeframeLite';
import useLazyLoading from 'effects/use-lazy-loading';

type Props = {
  src: string,
  className?: string,
  children?: React.Node,
};

const FreezeframeWrapper = (props: Props): React.Node => {
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const { src, className, children } = props;

  const srcLoaded = useLazyLoading(imgRef);

  useEffect(() => {
    if (srcLoaded && imgRef.current) {
      void new Freezeframe(imgRef.current);
    }
  }, [srcLoaded]);

  return (
    <div className={classnames(className, 'freezeframe-wrapper')}>
      <>
        <img ref={imgRef} data-src={src} className="freezeframe-img" />
        {children}
      </>
    </div>
  );
};

export default FreezeframeWrapper;
