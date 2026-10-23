// Webpack 5.111's desktop compiler/configuration surface, not the complete plugin API.
declare module 'webpack' {
  declare export type StatsOptions = {
    all?: boolean,
    errors?: boolean,
    warnings?: boolean,
    colors?: boolean,
    assets?: boolean,
    modules?: boolean,
    children?: boolean,
    ...
  };
  declare export type StatsJson = {
    errors?: Array<{ message: string, ... }>,
    warnings?: Array<{ message: string, ... }>,
    assets?: Array<{ name: string, size: number, ... }>,
    hash?: string,
    ...
  };
  declare export interface Stats {
    hasErrors(): boolean;
    hasWarnings(): boolean;
    toJson(options?: StatsOptions | string | boolean): StatsJson;
    toString(options?: StatsOptions | string | boolean): string;
  }
  declare export interface MultiStats extends Stats {
    stats: Array<Stats>;
  }
  declare export type Callback<S = Stats> = (error: Error | null | void, stats?: S) => void;
  declare export type WatchOptions = {
    aggregateTimeout?: number,
    ignored?: string | RegExp | Array<string>,
    poll?: number | boolean,
    ...
  };
  declare export interface Watching {
    close(callback: (error?: Error | null) => void): void;
    invalidate(callback?: (error?: Error | null) => void): void;
    suspend(): void;
    resume(): void;
  }
  declare export interface Compiler {
    run(callback: Callback): void;
    watch(options: WatchOptions, callback: Callback): Watching;
    close(callback: (error?: Error | null) => void): void;
  }
  declare export interface MultiCompiler {
    compilers: Array<Compiler>;
    run(callback: Callback<MultiStats>): void;
    watch(options: WatchOptions | Array<WatchOptions>, callback: Callback<MultiStats>): Watching;
    close(callback: (error?: Error | null) => void): void;
  }
  declare export interface Plugin {
    apply(compiler: Compiler): void;
  }
  declare type Rule = {
    test?: RegExp,
    include?: string | RegExp | Array<string | RegExp>,
    exclude?: string | RegExp | Array<string | RegExp>,
    loader?: string,
    options?: { [string]: unknown },
    use?: Array<string | { loader: string, options?: { [string]: unknown } }>,
    type?:
      | 'javascript/auto'
      | 'javascript/dynamic'
      | 'javascript/esm'
      | 'json'
      | 'asset'
      | 'asset/resource'
      | 'asset/source'
      | 'asset/inline'
      | 'asset/bytes'
      | 'webassembly/async'
      | 'webassembly/sync',
    parser?: { [string]: unknown },
    generator?: { filename?: string, ... },
    ...
  };
  declare export type Configuration = {
    name?: string,
    mode?: 'development' | 'production' | 'none',
    context?: string,
    target?: string | Array<string> | false,
    entry?: string | Array<string> | { [string]: string | Array<string> },
    output?: { path?: string, filename?: string, publicPath?: string, clean?: boolean, ... },
    module?: { rules?: Array<Rule>, ... },
    resolve?: {
      alias?: { [string]: string | false | Array<string> },
      fallback?: { [string]: string | false | Array<string> },
      modules?: Array<string>,
      extensions?: Array<string>,
      symlinks?: boolean,
      ...
    },
    plugins?: Array<Plugin | false | null | void>,
    optimization?: { minimize?: boolean, minimizer?: Array<Plugin | '...'>, ... },
    devtool?: string | false,
    watch?: boolean,
    watchOptions?: WatchOptions,
    stats?: StatsOptions | string | boolean,
    cache?: boolean | { type: 'memory' | 'filesystem', ... },
    externals?: { [string]: string | Array<string> },
    node?:
      | false
      | {
          __dirname?: boolean | 'warn-mock' | 'mock' | 'node-module' | 'eval-only',
          __filename?: boolean | 'warn-mock' | 'mock' | 'node-module' | 'eval-only',
          global?: boolean | 'warn',
          ...
        },
    ...
  };
  declare class DefinePlugin implements Plugin {
    constructor(definitions: { [string]: unknown }): void;
    apply(compiler: Compiler): void;
  }
  declare class ProvidePlugin implements Plugin {
    constructor(definitions: { [string]: string | Array<string> }): void;
    apply(compiler: Compiler): void;
  }
  declare class EnvironmentPlugin implements Plugin {
    constructor(keys: Array<string> | { [string]: unknown }): void;
    apply(compiler: Compiler): void;
  }
  declare class IgnorePlugin implements Plugin {
    constructor(
      options:
        | { resourceRegExp: RegExp, contextRegExp?: RegExp }
        | { checkResource: (resource: string, context: string) => boolean }
    ): void;
    apply(compiler: Compiler): void;
  }
  declare class NormalModuleReplacementPlugin implements Plugin {
    constructor(resourceRegExp: RegExp, replacement: string): void;
    apply(compiler: Compiler): void;
  }
  declare class HotModuleReplacementPlugin implements Plugin {
    apply(compiler: Compiler): void;
  }
  declare interface Webpack {
    (options: Configuration): Compiler;
    (options: Configuration, callback: Callback): Compiler | null;
    (options: Array<Configuration>): MultiCompiler;
    (options: Array<Configuration>, callback: Callback<MultiStats>): MultiCompiler | null;
    version: string;
    DefinePlugin: typeof DefinePlugin;
    ProvidePlugin: typeof ProvidePlugin;
    EnvironmentPlugin: typeof EnvironmentPlugin;
    IgnorePlugin: typeof IgnorePlugin;
    NormalModuleReplacementPlugin: typeof NormalModuleReplacementPlugin;
    HotModuleReplacementPlugin: typeof HotModuleReplacementPlugin;
  }
  declare module.exports: Webpack;
}
