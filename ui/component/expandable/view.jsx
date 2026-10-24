// @flow
import React, { useRef, useState, useLayoutEffect } from 'react';
import classnames from 'classnames';
import Button from 'component/button';

const COLLAPSED_HEIGHT = 120;

type Props = {
  children: React.Node | Array<React.Node>,
};

export default function Expandable(props: Props): React.Node {
  const [expanded, setExpanded] = useState(false);
  const { children } = props;
  const ref = useRef();
  const [canExpand, setCanExpand] = useState(false);
  useLayoutEffect(() => {
    const measure = () => setCanExpand(ref.current.getBoundingClientRect().height > COLLAPSED_HEIGHT);
    const observer = new ResizeObserver(measure);
    observer.observe(ref.current);
    measure();
    return () => observer.disconnect();
  }, []);

  function handleClick() {
    setExpanded(!expanded);
  }

  return (
    <div>
      <div
        className={classnames({
          'expandable--open': canExpand && expanded,
          'expandable--closed': canExpand && !expanded,
        })}
      >
        {/* Measure the full content, not the clipped container or its button. */}
        <div ref={ref}>{children}</div>
      </div>
      {canExpand && (
        <Button
          button="link"
          className="expandable__button"
          label={expanded ? __('Less') : __('More')}
          aria-expanded={expanded}
          onClick={handleClick}
        />
      )}
    </div>
  );
}
