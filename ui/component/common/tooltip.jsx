// @flow
import React from 'react';
import MUITooltip from '@mui/material/Tooltip';
import type { Node } from 'react';

type Props = {
  arrow?: boolean,
  children: Node,
  disableInteractive?: boolean,
  enterDelay?: number,
  followCursor?: boolean,
  placement?: string,
  title?: string | Node,
};

function Tooltip(props: Props): React.Node {
  const { arrow = true, children, disableInteractive = true, enterDelay = 300, title, followCursor, placement } = props;

  return (
    <MUITooltip
      arrow={arrow}
      disableInteractive={disableInteractive}
      enterDelay={enterDelay}
      enterNextDelay={enterDelay}
      title={title}
      followCursor={followCursor}
      placement={placement}
    >
      {children}
    </MUITooltip>
  );
}

export default Tooltip;
