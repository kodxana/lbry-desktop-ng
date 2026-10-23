// Chalk's ESM default export, limited to the development server's styling API.
declare module 'chalk' {
  declare interface Chalk {
    (...text: unknown[]): string;
    readonly magenta: Chalk;
    readonly yellow: Chalk;
    readonly bold: Chalk;
    readonly underline: Chalk;
  }

  declare export default Chalk;
}
