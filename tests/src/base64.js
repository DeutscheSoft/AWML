import { decodeBase64, encodeBase64 } from '../../src/utils/base64.js';

export default async function base64({ deepEqual }) {
  {
    const cases = [
      new Uint8Array([1, 2, 3, 5, 6]),
      new Uint8Array([233, 12, 3, 5, 6]),
      new Uint8Array(1033)
    ];

    for (const buf of cases) {
      deepEqual(
        buf,
        decodeBase64(encodeBase64(buf))
      );
    }
  }
}
