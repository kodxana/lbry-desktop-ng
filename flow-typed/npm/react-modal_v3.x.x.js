// react-modal 3.16.3 public props and static methods.
declare module 'react-modal' {
  import type { ComponentType, Node, ComponentProps } from 'react';
  declare type Classes = string | { base: string, afterOpen: string, beforeClose: string };
  declare type AppElement = HTMLElement | Array<HTMLElement> | HTMLCollection | NodeList;
  declare export type CloseEvent = {
    type: string,
    target: EventTarget | null,
    currentTarget: HTMLElement | null,
    nativeEvent: MouseEvent | KeyboardEvent,
    defaultPrevented: boolean,
    preventDefault(): void,
    stopPropagation(): void,
    isDefaultPrevented(): boolean,
    isPropagationStopped(): boolean,
    persist(): void,
    ...
  };
  declare type Style = { [string]: string | number | null | void };

  declare export type Styles = { content?: Style, overlay?: Style };
  declare export type Props = {
    isOpen?: boolean,
    children?: Node,
    style?: Styles,
    className?: Classes,
    overlayClassName?: Classes,
    portalClassName?: string,
    bodyOpenClassName?: string | null,
    htmlOpenClassName?: string | null,
    appElement?: AppElement,
    ariaHideApp?: boolean,
    closeTimeoutMS?: number,
    shouldFocusAfterRender?: boolean,
    shouldCloseOnEsc?: boolean,
    shouldCloseOnOverlayClick?: boolean,
    shouldReturnFocusAfterClose?: boolean,
    preventScroll?: boolean,
    parentSelector?: () => HTMLElement,
    onAfterOpen?: ({ overlayEl: HTMLDivElement, contentEl: HTMLDivElement }) => void,
    onAfterClose?: () => void,
    onRequestClose?: (event: CloseEvent) => void,
    aria?: { [string]: string | boolean | number },
    data?: { [string]: string | boolean | number },
    role?: string,
    contentLabel?: string,
    id?: string,
    testId?: string,
    overlayRef?: (element: HTMLDivElement | null) => void,
    contentRef?: (element: HTMLDivElement | null) => void,
    overlayElement?: (props: ComponentProps<'div'>, content: Node) => Node,
    contentElement?: (props: ComponentProps<'div'>, children: Node) => Node,
    ...
  };
  declare module.exports: ComponentType<Props> & {
    setAppElement(element: string | AppElement | null): void,
    defaultStyles: Styles,
  };
}
