// @flow
import React, { useRef, useState } from 'react';
import classnames from 'classnames';
import Button from 'component/button';
import { useRect } from '@reach/rect';

const COLLAPSED_HEIGHT = 120;

type Props = {
  children: React$Node | Array<React$Node>,
};

export default function Expandable(props: Props) {
  const [expanded, setExpanded] = useState(false);
  const { children } = props;
  const ref = useRef();
  const rect = useRect(ref);
  const canExpand = rect && rect.height > COLLAPSED_HEIGHT;

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
