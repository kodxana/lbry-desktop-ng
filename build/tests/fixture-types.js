// @flow
export type FixtureLocation = {
  pathname: string,
  search: string,
  hash: string,
  key: string,
  state: unknown,
  title?: string,
};

export type FixtureTransition = { location: FixtureLocation, retry: () => void, ... };
export type FixtureHistory = {
  location: FixtureLocation,
  entries: Array<FixtureLocation>,
  index: number,
  length: number,
  push: (string, state?: unknown) => void,
  replace: (string, state?: unknown) => void,
  go: (number) => void,
  goBack: () => void,
  goForward: () => void,
  block: ((FixtureTransition) => void) => () => void,
  listen: (() => void) => () => void,
};

export type FixtureState = {
  router: { location: FixtureLocation, ... },
  content: { positions: { [string]: { [string]: number } }, ... },
  ...
};

export type FixtureStore = { dispatch: Dispatch, getState: () => FixtureState, ... };

export function element(selector: string): HTMLElement {
  const node = document.querySelector(selector);
  if (!(node instanceof HTMLElement)) throw new Error(`Missing fixture element: ${selector}`);
  return node;
}
