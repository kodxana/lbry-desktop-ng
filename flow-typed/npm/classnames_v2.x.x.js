// Classnames 2 accepts nested arrays and truthy/falsy dictionary values.
declare module 'classnames' {
  declare type Argument = string | number | boolean | null | void | { [string]: unknown } | Array<Argument>;
  declare module.exports: (...classes: Array<Argument>) => string;
}

declare module 'classnames/bind' {
  import typeof classNames from 'classnames';
  declare module.exports: classNames;
}

declare module 'classnames/dedupe' {
  import typeof classNames from 'classnames';
  declare module.exports: classNames;
}
