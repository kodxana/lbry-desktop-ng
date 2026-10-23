// @flow
import * as React from 'react';

type Props = {
  text?: ?string,
  lines: number,
  showTooltip?: boolean,
  children?: React.Node,
};

const TruncatedText = (props: Props) => {
  const { text, children, lines, showTooltip = true } = props;
  const tooltip = showTooltip ? children || text : '';
  return (
    <span title={tooltip} className="truncated-text" style={{ WebkitLineClamp: lines }}>
      {children || text}
    </span>
  );
};

export default TruncatedText;
