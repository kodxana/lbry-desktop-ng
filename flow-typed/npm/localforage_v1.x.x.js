// localForage 1.10.0. Nullable results and config return values follow the implementation.
declare module 'localforage' {
  declare export type Options = {
    name?: string,
    storeName?: string,
    driver?: string | Array<string>,
    size?: number,
    version?: number,
    description?: string,
  };
  // Failure callbacks receive only the error; successful undefined writes become null.
  declare type Callback<T> = (error: unknown, value?: T) => void;
  declare type Stored<T> = T extends void ? null : T;
  declare interface Storage {
    getItem<T>(key: string, callback?: Callback<T | null>): Promise<T | null>;
    setItem<T>(key: string, value: T, callback?: Callback<Stored<T>>): Promise<Stored<T>>;
    removeItem(key: string, callback?: (error: unknown) => void): Promise<void>;
    clear(callback?: (error: unknown) => void): Promise<void>;
    length(callback?: Callback<number>): Promise<number>;
    key(index: number, callback?: Callback<string | null>): Promise<string | null>;
    keys(callback?: Callback<Array<string>>): Promise<Array<string>>;
    iterate<T, R>(
      iterator: (value: T, key: string, iteration: number) => R | void,
      callback?: Callback<R | void>
    ): Promise<R | void>;
  }
  declare export interface Driver extends Storage {
    _driver: string;
    _support?: boolean | (() => Promise<boolean>);
    _initStorage(options: Options): unknown;
    dropInstance?: (options?: Options, callback?: (error: unknown) => void) => Promise<void>;
  }
  declare export interface LocalForage extends Storage {
    INDEXEDDB: 'asyncStorage';
    WEBSQL: 'webSQLStorage';
    LOCALSTORAGE: 'localStorageWrapper';
    config(): Options;
    config<K extends keyof Options>(key: K): Options[K];
    config(options: Options): true | Error | Promise<void>;
    createInstance(options: Options): LocalForage;
    driver(): string | null;
    setDriver(
      driver: string | Array<string>,
      callback?: () => void,
      errorCallback?: (error: unknown) => void
    ): Promise<void>;
    defineDriver(driver: Driver, callback?: () => void, errorCallback?: (error: unknown) => void): Promise<void>;
    getDriver(name: string): Promise<Driver>;
    supports(name: string): boolean;
    ready(callback?: (error: unknown) => void): Promise<void>;
    dropInstance(options?: Options, callback?: (error: unknown) => void): Promise<void>;
  }
  declare module.exports: LocalForage;
}
