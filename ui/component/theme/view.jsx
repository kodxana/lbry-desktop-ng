// @flow
import React from 'react';

type Props = {
  themePath: ?string,
};

const Theme = (props: Props): React.Node => {
  const { themePath } = props;

  if (!themePath) {
    return null;
  }

  return <link href={themePath} rel="stylesheet" type="text/css" media="screen,print" />;
};

export default Theme;
