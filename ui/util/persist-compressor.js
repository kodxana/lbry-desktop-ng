// @flow
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import stringify from 'json-stringify-safe';

type Compressor = {
  in: (unknown, key?: string) => string,
  out: (unknown, key?: string) => unknown,
};

export default function createCompressor(): Compressor {
  return {
    in: (state) => compressToUTF16(stringify(state)),
    out: (state) => {
      if (typeof state !== 'string') return state;
      try {
        const decompressed = decompressFromUTF16(state);
        return decompressed === null ? null : JSON.parse(decompressed);
      } catch (_) {
        return null;
      }
    },
  };
}
