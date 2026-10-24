// Optional integrations attached by the renderer after initialization.
declare interface Window {
  i18n_messages: { [string]: string };
  _paq?: Array<[string, ...Array<unknown>]>;
  pendingLinkedCommentScroll?: boolean;
  player?: {
    pause(): void,
    currentTime(time?: number): number,
    ...
  };
  MSStream?: unknown;
}
