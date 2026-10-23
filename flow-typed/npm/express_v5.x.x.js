// Express 5 APIs used by the desktop development server and their common middleware contracts.
declare module 'express' {
  // Structural HTTP contracts for this API; Flow no longer bundles Node declarations.
  declare export interface Server {
    readonly listening: boolean;
    close(callback?: (error?: Error) => void): Server;
    address(): { address: string, family: string, port: number } | string | null;
    on(event: 'error', callback: (error: Error) => void): Server;
    on(event: 'listening' | 'close', callback: () => void): Server;
  }
  declare interface HttpResponse {
    statusCode: number;
    readonly headersSent: boolean;
    setHeader(name: string, value: string | number | ReadonlyArray<string>): HttpResponse;
    getHeader(name: string): string | number | Array<string> | void;
    write(data: string | Uint8Array): boolean;
    end(data?: string | Uint8Array): HttpResponse;
  }
  declare export type NextFunction = (error?: unknown) => void;
  declare export type Query = { [string]: void | string | Array<string | Query> | Query };
  declare export interface Request {
    url: string;
    method: string;
    headers: { [string]: string | Array<string> | void };
    app: Application;
    baseUrl: string;
    body: unknown;
    originalUrl: string;
    params: { [string]: string | Array<string> };
    readonly query: Query;
    readonly path: string;
    readonly hostname: string;
    readonly ip: string | void;
    readonly ips: Array<string>;
    readonly protocol: string;
    readonly secure: boolean;
    get(name: string): string | void;
    header(name: string): string | void;
    accepts(types: string | Array<string>): string | false;
    is(type: string): string | false | null;
  }
  declare export interface Response extends HttpResponse {
    app: Application;
    locals: { [string]: unknown };
    status(code: number): Response;
    send(body?: unknown): Response;
    json(body?: unknown): Response;
    jsonp(body?: unknown): Response;
    sendStatus(code: number): Response;
    type(contentType: string): Response;
    set(name: string, value: string | Array<string>): Response;
    set(headers: { [string]: string | Array<string> }): Response;
    header(name: string, value: string | Array<string>): Response;
    header(headers: { [string]: string | Array<string> }): Response;
    get(name: string): string | number | Array<string> | void;
    append(name: string, value: string | Array<string>): Response;
    location(path: string): Response;
    redirect(path: string): void;
    redirect(status: number, path: string): void;
    sendFile(path: string, options?: FileOptions, callback?: (error?: Error) => void): void;
    sendFile(path: string, callback: (error?: Error) => void): void;
  }
  declare export type RequestHandler = (request: Request, response: Response, next: NextFunction) => unknown;
  declare export type ErrorRequestHandler = (
    error: unknown,
    request: Request,
    response: Response,
    next: NextFunction
  ) => unknown;
  declare type Handler = RequestHandler | ErrorRequestHandler | Array<Handler>;
  declare type Path = string | RegExp | Array<string | RegExp>;
  declare export interface Router {
    (request: Request, response: Response, next: NextFunction): unknown;
    use(...handlers: Array<Handler>): Router;
    use(path: Path, ...handlers: Array<Handler>): Router;
    get(path: Path, ...handlers: Array<Handler>): Router;
    post(path: Path, ...handlers: Array<Handler>): Router;
    put(path: Path, ...handlers: Array<Handler>): Router;
    patch(path: Path, ...handlers: Array<Handler>): Router;
    delete(path: Path, ...handlers: Array<Handler>): Router;
    all(path: Path, ...handlers: Array<Handler>): Router;
  }
  declare export interface Application extends Router {
    locals: { [string]: unknown };
    get(name: string): unknown;
    get(path: Path, ...handlers: Array<Handler>): Application;
    set(name: string, value: unknown): Application;
    disable(name: string): Application;
    enable(name: string): Application;
    enabled(name: string): boolean;
    disabled(name: string): boolean;
    listen(port: number, callback?: (error?: Error) => void): Server;
    listen(port: number, host: string, callback?: (error?: Error) => void): Server;
    listen(path: string, callback?: (error?: Error) => void): Server;
  }
  declare export type FileOptions = {
    maxAge?: number | string,
    root?: string,
    lastModified?: boolean,
    headers?: { [string]: string },
    dotfiles?: 'allow' | 'deny' | 'ignore',
    acceptRanges?: boolean,
    cacheControl?: boolean,
    immutable?: boolean,
  };
  declare type StaticOptions = {
    ...FileOptions,
    etag?: boolean,
    extensions?: Array<string> | false,
    fallthrough?: boolean,
    index?: string | Array<string> | false,
    redirect?: boolean,
    setHeaders?: (
      response: HttpResponse,
      path: string,
      stat: { size: number, mtime: Date, isFile(): boolean, isDirectory(): boolean, ... }
    ) => void,
  };
  declare interface Express {
    (): Application;
    Router(options?: { caseSensitive?: boolean, mergeParams?: boolean, strict?: boolean }): Router;
    static(root: string, options?: StaticOptions): RequestHandler;
    json(options?: {
      limit?: string | number,
      strict?: boolean,
      inflate?: boolean,
      type?: string | Array<string>,
    }): RequestHandler;
    urlencoded(options?: {
      extended?: boolean,
      limit?: string | number,
      parameterLimit?: number,
      inflate?: boolean,
    }): RequestHandler;
    text(options?: { limit?: string | number, defaultCharset?: string, inflate?: boolean }): RequestHandler;
    raw(options?: { limit?: string | number, inflate?: boolean, type?: string | Array<string> }): RequestHandler;
  }
  declare module.exports: Express;
}
