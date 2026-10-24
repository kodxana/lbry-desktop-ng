declare module '@ariakit/react' {
  import type { ComponentType, ComponentProps, Node } from 'react';
  declare type MenuState = { open: boolean };
  declare type MenuStore = { getState: () => MenuState };
  declare type TabStore = { getState: () => { selectedId: ?string } };
  declare type ButtonProps = { ...ComponentProps<'button'>, render?: Node };
  declare export var MenuProvider: ComponentType<{
    children: Node,
    placement?: string,
    focusLoop?: boolean,
    rtl?: boolean,
  }>;
  declare export var Menu: ComponentType<{
    ...ComponentProps<'div'>,
    portal?: boolean,
    autoFocusOnHide?: () => boolean,
  }>;
  declare export var MenuButton: ComponentType<ButtonProps>;
  declare export var MenuItem: ComponentType<ButtonProps>;
  declare export var MenuItemCheckbox: ComponentType<{
    ...ButtonProps,
    name: string,
    checked?: boolean,
    onChange?: () => void,
  }>;
  declare export function useMenuContext(): ?MenuStore;
  declare export function useTabStore(options: {
    rtl?: boolean,
    defaultSelectedId?: string,
    selectedId?: ?string,
    setSelectedId?: (?string) => void,
  }): TabStore;
  declare export function useStoreState(store: TabStore, key: 'selectedId'): ?string;
  declare export var TabProvider: ComponentType<{ store: TabStore, children: Node }>;
  declare export var TabList: ComponentType<ComponentProps<'div'>>;
  declare export var Tab: ComponentType<{ ...ButtonProps, accessibleWhenDisabled?: boolean }>;
  declare export var TabPanel: ComponentType<{ ...ComponentProps<'div'>, tabId?: string }>;
  declare export var ComboboxProvider: ComponentType<{
    children: Node,
    inputValue: string,
    setInputValue: (string) => void,
    resetValueOnHide?: boolean,
    resetValueOnSelect?: boolean,
  }>;
  declare export function useComboboxContext(): ?{ show: () => void };
  declare export var Combobox: ComponentType<{
    ...ComponentProps<'input'>,
    moveOnKeyPress?: ({ key: string, ... }) => boolean,
  }>;
  declare export var ComboboxPopover: ComponentType<{
    ...ComponentProps<'div'>,
    portal?: boolean,
    unmountOnHide?: boolean,
    sameWidth?: boolean,
    gutter?: number,
  }>;
  declare export var ComboboxItem: ComponentType<{
    ...ComponentProps<'div'>,
    value: string,
    setValueOnClick?: boolean,
    selectValueOnClick?: boolean,
  }>;
}

declare module 'node-html-parser' {
  declare export class HTMLElement {
    getElementsByTagName(name: string): Array<HTMLElement>;
    getAttribute(name: string): string | void;
  }
  declare export function parse(html: string): HTMLElement;
}

declare module 'react-awesome-lightbox' {
  import type { ComponentType } from 'react';
  declare export default ComponentType<{ image: string, title?: string, onClose: () => void, portal?: boolean }>;
}
