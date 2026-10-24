declare module 'lz-string' {
  declare export function compressToUTF16(value: string | void): string;
  declare export function decompressFromUTF16(value: string): string | null;
}

declare module 'json-stringify-safe' {
  declare module.exports: (unknown) => string | void;
}
