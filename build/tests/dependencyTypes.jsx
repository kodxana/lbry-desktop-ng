// @flow
import * as React from 'react';
import {
  connect,
  legacy_connect,
  Provider,
  useSelector,
  useDispatch,
  useStore,
  createSelectorHook,
  createDispatchHook,
  createStoreHook,
  type Dispatch,
  type Store,
} from 'react-redux';
import * as prettier from 'prettier';
import storage from 'localforage';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import classes from 'classnames';
import dedupe from 'classnames/dedupe';
import bind from 'classnames/bind';
import chalk from 'chalk';

type State = { balance: string };
type Own = { address: string };
const select = (state: State, own: Own): { balance: string } => ({ balance: state.balance });
function View(props: { address: string, balance: string }): React.Node {
  return <span>{props.balance}</span>;
}
const Connected = connect(select)(View);
export const connected: React.Node = <Connected address="fixture" />;
const Factory = legacy_connect(() => select)(View);
export const factory: React.Node = <Factory address="fixture" />;
const save =
  (amount: string): (() => Promise<string>) =>
  () =>
    Promise.resolve(amount);
function SaveView(props: { save: (amount: string) => Promise<string> }): React.Node {
  return null;
}
const Saved = connect(null, { save })(SaveView);
export const saved: React.Node = <Saved />;
const Mapped = connect(null, (dispatch: Dispatch): ({ save: (amount: string) => void }) => ({
  save: (amount: string): void => {
    dispatch({ type: 'SAVE', amount });
  },
}))((props: { save: (amount: string) => void }): React.Node => null);
export const mapped: React.Node = <Mapped />;
const Merged = connect(select, null, (state: State, actions: { dispatch: Dispatch }, own: Own): { label: string } => ({
  label: own.address + state.balance,
}))((props: { label: string }): React.Node => <span>{props.label}</span>);
export const merged: React.Node = <Merged address="fixture" />;

export function Hooks(): React.Node {
  const balance: string = useSelector((state: State) => state.balance);
  const typedBalance: string = useSelector.withTypes<State>()((state) => state.balance, {
    devModeChecks: { stabilityCheck: 'once', identityFunctionCheck: 'always' },
  });
  const result: { type: 'SAVE', amount: string } = useDispatch()({ type: 'SAVE', amount: balance });
  const typedDispatch: (amount: string) => Promise<string> =
    useDispatch.withTypes<(amount: string) => Promise<string>>()();
  const store = useStore.withTypes<Store<State>>()();
  return <span>{typedBalance + result.amount + store.getState().balance + typeof typedDispatch}</span>;
}
const useCustomSelector = createSelectorHook();
const useCustomDispatch = createDispatchHook();
const useCustomStore = createStoreHook();
export function CustomHooks(): React.Node {
  const balance: string = useCustomSelector((state: State) => state.balance);
  const result: { type: 'SAVE', amount: string } = useCustomDispatch()({ type: 'SAVE', amount: balance });
  const store: Store<unknown> = useCustomStore();
  return <span>{result.amount + typeof store.getState()}</span>;
}
export function Provided(props: {
  store: { getState(): State, dispatch: Dispatch, subscribe(() => void): () => void },
}): React.Node {
  return (
    <Provider store={props.store} serverState={{ balance: '0' }} stabilityCheck="once">
      <Hooks />
    </Provider>
  );
}

export async function formatting(): Promise<string> {
  const formatted: string = await prettier.format('let value=1', { parser: 'babel', printWidth: 80 });
  const valid: boolean = await prettier.check(formatted, { parser: 'babel' });
  const cursor = await prettier.formatWithCursor(formatted, { parser: 'babel', cursorOffset: 5 });
  const config = await prettier.resolveConfig('fixture.js');
  const file = await prettier.getFileInfo('fixture.js');
  await prettier.clearConfigCache();
  return valid ? cursor.formatted : String(config?.tabWidth ?? file.inferredParser);
}
export async function persistence(): Promise<void> {
  const database = storage.createInstance({ name: 'fixture', version: 1 });
  const configured: true | Error | Promise<void> = database.config({ driver: storage.INDEXEDDB });
  await configured;
  await database.ready();
  const saved: string = await database.setItem('balance', '0.125');
  const missing: string | null = await database.getItem<string>('missing');
  const key: string | null = await database.key(99);
  await database.length((error: unknown, count?: number): void => {});
  const empty: null = await database.setItem('empty', undefined);
  const first: string | void = await database.iterate<string, string>((value, name, iteration) => value);
  await database.clear();
  await database.dropInstance();
  void [saved, missing, key, first, empty];
}
export function server(): void {
  const app = express();
  app.use(
    express.static('dist', {
      dotfiles: 'deny',
      index: false,
      setHeaders: (response, filename, stat): void => {
        response.setHeader('x-size', stat.size);
      },
    })
  );
  app.get('/balance', async (request: Request, response: Response): Promise<void> => {
    const header: string | void = request.get('x-fixture');
    response.status(200).json({ balance: '0.125', header });
  });
  app.use((error: unknown, request: Request, response: Response, next: NextFunction): void => {
    response.status(500).json({ error: String(error) });
  });
  const server = app.listen(0, '127.0.0.1', (error?: Error): void => {});
  server.close();
}
export const names: string = classes('one', ['two', [3, null]], { enabled: true, hidden: 0 });
export const unique: string = dedupe('one', 'one');
export const bound: string = bind.bind({ one: 'scoped' })('one');
export const colored: string = chalk.yellow.bold('test', 1);
