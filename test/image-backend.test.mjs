// Node image backend test: composite RGBA glyph cells into an RGB atlas page, encode a
// PNG, then round-trip decode (parse chunks + zlib inflate + strip row filters) and verify
// the pixels landed at the right offsets. Self-contained — no external PNG decoder.

import assert from 'node:assert';
import zlib from 'node:zlib';

import { createNodeImageBackend } from '../src/image-backend-node.js';

function decodePngRgb(png) {
    const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
    let off = 8; // skip signature
    let width = 0, height = 0;
    const idats = [];
    while (off < png.length) {
        const len = dv.getUint32(off);
        const type = String.fromCharCode(...png.subarray(off + 4, off + 8));
        const data = png.subarray(off + 8, off + 8 + len);
        if (type === 'IHDR') {
            const d = new DataView(data.buffer, data.byteOffset, data.byteLength);
            width = d.getUint32(0);
            height = d.getUint32(4);
            assert.strictEqual(data[8], 8, 'bit depth 8');
            assert.strictEqual(data[9], 2, 'color type RGB');
        } else if (type === 'IDAT') {
            idats.push(Buffer.from(data));
        } else if (type === 'IEND') {
            break;
        }
        off += 12 + len;
    }
    const raw = new Uint8Array(zlib.inflateSync(Buffer.concat(idats)));
    const stride = width * 3;
    const rgb = new Uint8Array(width * height * 3);
    for (let y = 0; y < height; y++) {
        assert.strictEqual(raw[y * (stride + 1)], 0, 'filter type 0');
        rgb.set(raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride), y * stride);
    }
    return { width, height, rgb };
}

const cell = (r, g, b) => ({ width: 2, height: 2, data: Uint8Array.from(
    Array.from({ length: 4 }, () => [r, g, b, 255]).flat()) });

const backend = createNodeImageBackend();
const png = await backend.composite({
    width: 4,
    height: 2,
    glyphs: [
        { x: 0, y: 0, bitmap: cell(255, 0, 0) }, // red 2x2 top-left
        { x: 2, y: 0, bitmap: cell(0, 255, 0) }  // green 2x2 top-right
    ]
});

assert.deepStrictEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'PNG signature');

const { width, height, rgb } = decodePngRgb(png);
assert.strictEqual(width, 4);
assert.strictEqual(height, 2);

const at = (x, y) => [rgb[(y * width + x) * 3], rgb[(y * width + x) * 3 + 1], rgb[(y * width + x) * 3 + 2]];
assert.deepStrictEqual(at(0, 0), [255, 0, 0], 'red cell placed');
assert.deepStrictEqual(at(1, 1), [255, 0, 0], 'red cell fills 2x2');
assert.deepStrictEqual(at(2, 0), [0, 255, 0], 'green cell placed at x=2');
assert.deepStrictEqual(at(3, 1), [0, 255, 0], 'green cell fills 2x2');

console.log('OK — Node image backend: composite + PNG encode + round-trip decode.');
