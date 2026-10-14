// @flow
import React from 'react';
import { MenuProvider, Menu as Popup, MenuButton, MenuItem } from '@ariakit/react';
import classnames from 'classnames';

function Menu({ children }: { children: React$Node }) {
  return (
    <MenuProvider placement="bottom-start" focusLoop rtl={document.documentElement.dir === 'rtl'}>
      {children}
    </MenuProvider>
  );
}

function MenuList({ className, ...props }: { className?: string, children: React$Node }) {
  return (
    <Popup
      {...props}
      className={classnames('menu__popup', className)}
      portal
      unmountOnHide
      onClick={(event) => {
        // Menu actions inside claim cards must not activate the card's link.
        event.stopPropagation();
      }}
    />
  );
}

export { Menu, MenuButton, MenuList, MenuItem };
