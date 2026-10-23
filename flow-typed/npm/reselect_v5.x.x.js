// Reselect 5.3: selector arguments/results and the built-in memoizers used by the desktop.
declare module 'reselect' {
  declare type AnyFunction = (...args: ReadonlyArray<empty>) => unknown;
  declare type Cache = { clearCache(): void, resultsCount(): number, resetResultsCount(): void };
  declare export type Memoized<F> = F & Cache;
  declare export type MemoizeOptions = {
    equalityCheck?: (left: unknown, right: unknown) => boolean,
    resultEqualityCheck?: (left: unknown, right: unknown) => boolean,
    maxSize?: number,
  };
  declare export function lruMemoize<F extends AnyFunction>(
    fn: F,
    options?: MemoizeOptions | ((left: unknown, right: unknown) => boolean)
  ): Memoized<F>;
  declare export function weakMapMemoize<F extends AnyFunction>(
    fn: F,
    options?: { resultEqualityCheck?: (left: unknown, right: unknown) => boolean }
  ): Memoized<F>;
  declare type Checks = {
    inputStabilityCheck?: 'always' | 'once' | 'never',
    identityFunctionCheck?: 'always' | 'once' | 'never',
  };
  declare type Options = {
    memoize?: typeof lruMemoize | typeof weakMapMemoize,
    argsMemoize?: typeof lruMemoize | typeof weakMapMemoize,
    memoizeOptions?: MemoizeOptions | Array<MemoizeOptions>,
    argsMemoizeOptions?: MemoizeOptions | Array<MemoizeOptions>,
    devModeChecks?: Checks,
  };
  declare type Input<S, P, Q, R> = (state: S, props: P, extra: Q) => R;
  declare type Selector<S, P, Q, R> = [Q] extends [void]
    ? [P] extends [void]
      ? (state: S) => R
      : void extends P
        ? (state: S, props?: P) => R
        : (state: S, props: P) => R
    : void extends Q
      ? void extends P
        ? (state: S, props?: P, extra?: Q) => R
        : (state: S, props: P, extra?: Q) => R
      : (state: S, props: P, extra: Q) => R;
  declare export type OutputSelector<S, P, Q, Results, Result> = Selector<S, P, Q, Result> &
    Cache & {
      resultFunc: (...values: Results) => Result,
      memoizedResultFunc: Memoized<(...values: Results) => Result>,
      dependencies: ReadonlyArray<Input<S, P, Q, unknown>>,
      memoize: typeof lruMemoize | typeof weakMapMemoize,
      argsMemoize: typeof lruMemoize | typeof weakMapMemoize,
      lastResult(): Result | void,
      recomputations(): number,
      resetRecomputations(): void,
      dependencyRecomputations(): number,
      resetDependencyRecomputations(): void,
    };
  // shortcut: covers the desktop's five-input, three-argument selectors; extend when a caller needs more.
  declare export interface CreateSelector<FixedState = unknown> {
    <S extends FixedState = FixedState, P = void, Q = void, A = unknown, R = unknown>(
      s1: Input<S, P, Q, A>,
      result: (a: A) => R,
      options?: Options
    ): OutputSelector<S, P, Q, [A], R>;
    <S extends FixedState = FixedState, P = void, Q = void, A = unknown, R = unknown>(
      selectors: readonly [Input<S, P, Q, A>],
      result: (a: A) => R,
      options?: Options
    ): OutputSelector<S, P, Q, [A], R>;
    <S extends FixedState = FixedState, P = void, Q = void, A = unknown, B = unknown, R = unknown>(
      s1: Input<S, P, Q, A>,
      s2: Input<S, P, Q, B>,
      result: (a: A, b: B) => R,
      options?: Options
    ): OutputSelector<S, P, Q, [A, B], R>;
    <S extends FixedState = FixedState, P = void, Q = void, A = unknown, B = unknown, R = unknown>(
      selectors: readonly [Input<S, P, Q, A>, Input<S, P, Q, B>],
      result: (a: A, b: B) => R,
      options?: Options
    ): OutputSelector<S, P, Q, [A, B], R>;
    <S extends FixedState = FixedState, P = void, Q = void, A = unknown, B = unknown, C = unknown, R = unknown>(
      s1: Input<S, P, Q, A>,
      s2: Input<S, P, Q, B>,
      s3: Input<S, P, Q, C>,
      result: (a: A, b: B, c: C) => R,
      options?: Options
    ): OutputSelector<S, P, Q, [A, B, C], R>;
    <S extends FixedState = FixedState, P = void, Q = void, A = unknown, B = unknown, C = unknown, R = unknown>(
      selectors: readonly [Input<S, P, Q, A>, Input<S, P, Q, B>, Input<S, P, Q, C>],
      result: (a: A, b: B, c: C) => R,
      options?: Options
    ): OutputSelector<S, P, Q, [A, B, C], R>;
    <
      S extends FixedState = FixedState,
      P = void,
      Q = void,
      A = unknown,
      B = unknown,
      C = unknown,
      D = unknown,
      R = unknown,
    >(
      s1: Input<S, P, Q, A>,
      s2: Input<S, P, Q, B>,
      s3: Input<S, P, Q, C>,
      s4: Input<S, P, Q, D>,
      result: (a: A, b: B, c: C, d: D) => R,
      options?: Options
    ): OutputSelector<S, P, Q, [A, B, C, D], R>;
    <
      S extends FixedState = FixedState,
      P = void,
      Q = void,
      A = unknown,
      B = unknown,
      C = unknown,
      D = unknown,
      R = unknown,
    >(
      selectors: readonly [Input<S, P, Q, A>, Input<S, P, Q, B>, Input<S, P, Q, C>, Input<S, P, Q, D>],
      result: (a: A, b: B, c: C, d: D) => R,
      options?: Options
    ): OutputSelector<S, P, Q, [A, B, C, D], R>;
    <
      S extends FixedState = FixedState,
      P = void,
      Q = void,
      A = unknown,
      B = unknown,
      C = unknown,
      D = unknown,
      E = unknown,
      R = unknown,
    >(
      s1: Input<S, P, Q, A>,
      s2: Input<S, P, Q, B>,
      s3: Input<S, P, Q, C>,
      s4: Input<S, P, Q, D>,
      s5: Input<S, P, Q, E>,
      result: (a: A, b: B, c: C, d: D, e: E) => R,
      options?: Options
    ): OutputSelector<S, P, Q, [A, B, C, D, E], R>;
    <
      S extends FixedState = FixedState,
      P = void,
      Q = void,
      A = unknown,
      B = unknown,
      C = unknown,
      D = unknown,
      E = unknown,
      R = unknown,
    >(
      selectors: readonly [
        Input<S, P, Q, A>,
        Input<S, P, Q, B>,
        Input<S, P, Q, C>,
        Input<S, P, Q, D>,
        Input<S, P, Q, E>,
      ],
      result: (a: A, b: B, c: C, d: D, e: E) => R,
      options?: Options
    ): OutputSelector<S, P, Q, [A, B, C, D, E], R>;
    withTypes<S extends FixedState>(): CreateSelector<S>;
  }
  declare export var createSelector: CreateSelector;
  declare export function createSelectorCreator(options: {
    ...Options,
    memoize: typeof lruMemoize | typeof weakMapMemoize,
  }): CreateSelector;
  declare export function createSelectorCreator(
    memoize: typeof lruMemoize | typeof weakMapMemoize,
    ...options: Array<MemoizeOptions | ((left: unknown, right: unknown) => boolean)>
  ): CreateSelector;
  declare export function setGlobalDevModeChecks(checks: Checks): void;
}
