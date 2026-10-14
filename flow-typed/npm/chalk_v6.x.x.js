// Chalk's ESM default export, limited to the development server's styling API.
declare module 'chalk' {
  declare interface Chalk {
    (...text: string[]): string;
    +magenta: Chalk;
    +yellow: Chalk;
    +bold: Chalk;
    +underline: Chalk;
  }

  declare export default Chalk;
}
