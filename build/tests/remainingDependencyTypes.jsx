// @flow
import * as React from 'react';
import { createSelector, createSelectorCreator, lruMemoize, weakMapMemoize } from 'reselect';
import webpack from 'webpack';
import type { Stats, Compiler, MultiStats } from 'webpack';
import Modal from 'react-modal';

type State = { balance: string, addresses: Array<string> };
const balance = (state: State): string => state.balance;
const address = (state: State, index: number): string => state.addresses[index];
const selected = createSelector([balance, address], (amount: string, dest: string): string => amount + dest);
export const wallet: string = selected({ balance: '0.25', addresses: ['fixture'] }, 0);
const positional = createSelector(balance, (amount: string): string => amount.toUpperCase());
export const upper: string = positional({ balance: '0.25', addresses: [] });
const typed = createSelector.withTypes<State>()([balance], (amount: string): string => amount);
export const typedValue: string = typed({ balance: '0.25', addresses: [] });
const custom = createSelectorCreator({ memoize: lruMemoize, memoizeOptions: { maxSize: 2 } })(
  [balance],
  (amount: string): string => amount
);
export const cachedValue: string = custom({ balance: '0.25', addresses: [] });
export const recomputations: number = selected.recomputations();
export const result: string | void = selected.lastResult();
const memoized = weakMapMemoize((value: string): number => value.length);
export const length: number = memoized('fixture');
memoized.clearCache();

export function compile(): void {
  const compiler: Compiler = webpack({
    mode: 'production',
    target: 'web',
    entry: './fixture.js',
    output: { filename: 'bundle.js', path: '/tmp/fixture' },
    module: { rules: [{ test: /\.png$/, type: 'asset/resource' }] },
    resolve: { fallback: { path: false } },
    plugins: [new webpack.DefinePlugin({ ENABLED: true }), new webpack.IgnorePlugin({ resourceRegExp: /ignored/ })],
  });
  compiler.run((error: Error | null | void, stats?: Stats): void => {
    if (error || !stats) return;
    const errors: boolean = stats.hasErrors();
    const report: string = stats.toString({ colors: false });
    void [errors, report];
    compiler.close((closeError?: Error | null): void => {});
  });
  const multiple = webpack([{ entry: './one.js' }, { entry: './two.js' }]);
  multiple.run((error: Error | null | void, stats?: MultiStats): void => {
    if (stats)
      stats.stats.forEach((item: Stats): void => {
        item.hasErrors();
      });
  });
}
export const modal: React.Node = (
  <Modal
    isOpen
    contentLabel="Wallet backup"
    preventScroll
    onAfterOpen={({ contentEl }) => contentEl.focus()}
    onRequestClose={(event) => event.preventDefault()}
    style={{ content: { width: 400, color: 'white' } }}
    overlayElement={(props, children) => <div {...props}>{children}</div>}
  >
    Backup
  </Modal>
);
Modal.setAppElement('#app');

// All call shapes used by the desktop: five inputs, three arguments and typed selector factories.
const multi = createSelector(
  balance,
  address,
  (state: State, index: number, suffix: string): string => suffix,
  balance,
  balance,
  (a: string, b: string, c: string, d: string, e: string): string => a + b + c + d + e
);
export const multiValue: string = multi({ balance: '0.25', addresses: ['fixture'] }, 0, '!');
const inferred = createSelector.withTypes<State>()([(state) => state.balance], (amount) => amount);
export const inferredValue: string = inferred({ balance: '0.25', addresses: [] });

const composed = createSelector(positional, typed, (a: string, b: string): string => a + b);
export const composedValue: string = composed({ balance: '0.25', addresses: [] });
const composedWithIndex = createSelector(positional, address, (a: string, b: string): string => a + b);
export const composedAddress: string = composedWithIndex({ balance: '0.25', addresses: ['fixture'] }, 0);
const optionalIndex = createSelector(
  (state: State, index: number = 0): string => state.addresses[index],
  (value: string): string => value.toUpperCase()
);
export const defaultAddress: string = optionalIndex({ balance: '0.25', addresses: ['fixture'] });
export const indexedAddress: string = optionalIndex({ balance: '0.25', addresses: ['fixture'] }, 0);
Modal.setAppElement(null);
const optionalSuffix = createSelector(
  (state: State, index: number = 0, suffix: string = ''): string => state.addresses[index] + suffix,
  (value: string): string => value.toUpperCase()
);
export const defaultSuffix: string = optionalSuffix({ balance: '0.25', addresses: ['fixture'] });
export const explicitSuffix: string = optionalSuffix({ balance: '0.25', addresses: ['fixture'] }, 0, '!');

export const closedModal: React.Node = <Modal />;
