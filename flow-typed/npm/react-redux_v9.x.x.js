// Maintained against React Redux 9.3.0; checked by build/testDependencyTypes.js.
declare module 'react-redux' {
  import type { ComponentType, Context, Node } from 'react';

  declare export type Action = { type: string, ... };
  declare export type Dispatch = <A extends Action>(action: A) => A;
  declare export type Store<S, D = Dispatch> = {
    getState(): S,
    dispatch: D,
    subscribe(listener: () => void): () => void,
    ...
  };
  declare export type DevModeCheckFrequency = 'never' | 'once' | 'always';
  declare export type EqualityFn<T> = (left: T, right: T) => boolean;
  declare export type UseSelectorOptions<T> = {
    equalityFn?: EqualityFn<T>,
    devModeChecks?: {
      stabilityCheck?: DevModeCheckFrequency,
      identityFunctionCheck?: DevModeCheckFrequency,
    },
  };
  declare export interface UseSelector<S> {
    <State extends S = S, T = unknown>(
      selector: (state: State) => T,
      options?: EqualityFn<T> | UseSelectorOptions<T>
    ): T;
    withTypes<State extends S>(): UseSelector<State>;
  }
  declare export interface UseDispatch<D extends AnyFunction> {
    <AppDispatch extends AnyFunction = D>(): AppDispatch;
    withTypes<AppDispatch extends AnyFunction>(): UseDispatch<AppDispatch>;
  }
  declare type StoreShape = {
    getState(): unknown,
    readonly dispatch: AnyFunction,
    subscribe(listener: () => void): () => void,
    ...
  };
  declare export interface UseStore<S extends StoreShape> {
    (): S;
    withTypes<AppStore extends StoreShape>(): UseStore<AppStore>;
  }
  declare export var useSelector: UseSelector<unknown>;
  declare export var useDispatch: UseDispatch<Dispatch>;
  declare export var useStore: UseStore<Store<unknown>>;
  declare export type TypedUseSelectorHook<S> = UseSelector<S>;

  declare export type ReactReduxContextValue<S, D = Dispatch> = {
    store: Store<S, D>,
    getServerState?: () => S,
    stabilityCheck?: DevModeCheckFrequency,
    identityFunctionCheck?: DevModeCheckFrequency,
    ...
  };
  declare export var ReactReduxContext: Context<ReactReduxContextValue<unknown> | null>;
  declare export function createSelectorHook<S = unknown>(
    context?: Context<ReactReduxContextValue<S> | null>
  ): UseSelector<S>;
  declare export function createDispatchHook<S = unknown, D extends AnyFunction = Dispatch>(
    context?: Context<ReactReduxContextValue<S, D> | null>
  ): UseDispatch<D>;
  declare export function createStoreHook<S = unknown, D extends AnyFunction = Dispatch>(
    context?: Context<ReactReduxContextValue<S, D> | null>
  ): UseStore<Store<S, D>>;
  declare export type ProviderProps<S, D = Dispatch> = {
    store: Store<S, D>,
    children?: Node,
    serverState?: S,
    context?: Context<ReactReduxContextValue<S, D> | null>,
    stabilityCheck?: DevModeCheckFrequency,
    identityFunctionCheck?: DevModeCheckFrequency,
  };
  declare export function Provider<S, D>(props: ProviderProps<S, D>): Node;
  declare export function batch(callback: () => void): void;
  declare export function shallowEqual(left: unknown, right: unknown): boolean;

  declare type AnyFunction = (...args: ReadonlyArray<empty>) => unknown;
  declare export type ResolveThunks<Creators> = {
    [K in keyof Creators]: Creators[K] extends (...args: infer Args) => infer Result
      ? (...args: Args) => Result extends AnyFunction ? ReturnType<Result> : Result
      : Creators[K],
  };
  declare type MapState<S, Own, Selected> =
    ((state: S, own: Own) => Selected) | ((state: S, own: Own) => (state: S, own: Own) => Selected);
  declare type MapDispatch<D, Own, Bound> =
    ((dispatch: D, own: Own) => Bound) | ((dispatch: D, own: Own) => (dispatch: D, own: Own) => Bound);
  declare export type ConnectOptions<S, Own, Selected, Merged> = {
    forwardRef?: boolean,
    context?: Context<ReactReduxContextValue<S> | null>,
    areStatesEqual?: (next: S, previous: S, nextOwn: Own, previousOwn: Own) => boolean,
    areOwnPropsEqual?: EqualityFn<Own>,
    areStatePropsEqual?: EqualityFn<Selected>,
    areMergedPropsEqual?: EqualityFn<Merged>,
  };
  declare type Resolved<T> = T extends AnyFunction ? ReturnType<T> : T;
  declare type Matching<Injected, Props> = {
    [K in keyof Props]: K extends keyof Injected ? Injected[K] : Props[K],
  };
  declare type Connector<Own, Injected> = <P>(
    component: ComponentType<P> & ComponentType<Matching<Injected, P>>
  ) => ComponentType<{ ...Omit<P, keyof Injected>, ...Own }> & { WrappedComponent: ComponentType<P> };

  declare export function connect<S = unknown, Own = {}, Selected = {}, D = Dispatch>(
    mapState?: MapState<S, Own, Selected> | null,
    mapDispatch?: null,
    mergeProps?: null,
    options?: ConnectOptions<S, Own, Resolved<Selected>, { ...Own, ...Resolved<Selected>, dispatch: D }>
  ): Connector<Own, { ...Resolved<Selected>, dispatch: D }>;
  declare export function connect<S = unknown, Own = {}, Selected = {}, D = Dispatch, Bound = {}>(
    mapState: MapState<S, Own, Selected> | null | void,
    mapDispatch: MapDispatch<D, Own, Bound>,
    mergeProps?: null,
    options?: ConnectOptions<S, Own, Resolved<Selected>, { ...Own, ...Resolved<Selected>, ...Resolved<Bound> }>
  ): Connector<Own, { ...Resolved<Selected>, ...Resolved<Bound> }>;
  declare export function connect<
    S = unknown,
    Own = {},
    Selected = {},
    Creators extends { readonly [string]: AnyFunction } = {},
  >(
    mapState: MapState<S, Own, Selected> | null | void,
    mapDispatch: Creators,
    mergeProps?: null,
    options?: ConnectOptions<S, Own, Resolved<Selected>, { ...Own, ...Resolved<Selected>, ...ResolveThunks<Creators> }>
  ): Connector<Own, { ...Resolved<Selected>, ...ResolveThunks<Creators> }>;
  declare export function connect<S = unknown, Own = {}, Selected = {}, D = Dispatch, Merged = {}>(
    mapState: MapState<S, Own, Selected> | null | void,
    mapDispatch: null | void,
    mergeProps: (state: Resolved<Selected>, dispatch: { dispatch: D }, own: Own) => Merged,
    options?: ConnectOptions<S, Own, Resolved<Selected>, Merged>
  ): Connector<Own, Merged>;
  declare export function connect<S = unknown, Own = {}, Selected = {}, D = Dispatch, Bound = {}, Merged = {}>(
    mapState: MapState<S, Own, Selected> | null | void,
    mapDispatch: MapDispatch<D, Own, Bound>,
    mergeProps: (state: Resolved<Selected>, dispatch: Resolved<Bound>, own: Own) => Merged,
    options?: ConnectOptions<S, Own, Resolved<Selected>, Merged>
  ): Connector<Own, Merged>;
  declare export function connect<
    S = unknown,
    Own = {},
    Selected = {},
    Creators extends { readonly [string]: AnyFunction } = {},
    Merged = {},
  >(
    mapState: MapState<S, Own, Selected> | null | void,
    mapDispatch: Creators,
    mergeProps: (state: Resolved<Selected>, dispatch: ResolveThunks<Creators>, own: Own) => Merged,
    options?: ConnectOptions<S, Own, Resolved<Selected>, Merged>
  ): Connector<Own, Merged>;
  declare export var legacy_connect: typeof connect;
}
