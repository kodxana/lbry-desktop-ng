// @flow
import React from 'react';
import { Link } from 'react-router-dom';
import { MenuItem } from 'component/common/menu';
import Icon from 'component/common/icon';

type Props = {
  icon: string,
  name: string,
  page: string,
};

export default function HeaderMenuLink(props: Props) {
  const { icon, name, page } = props;

  return (
    <MenuItem className="menu__link" render={<Link to={`/$/${page}`} />}>
      <Icon aria-hidden icon={icon} />
      {name}
    </MenuItem>
  );
}
