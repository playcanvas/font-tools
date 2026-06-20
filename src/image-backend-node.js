/**
 * Node image backend: composites RGBA glyph cells into an RGB atlas page and encodes a
 * PNG, using only Node's built-in zlib (no native deps). The atlas is 8-bit RGB with a
 * black background — matching the Editor's output and what the MSDF shader samples (.rgb,
 * median of the three channels). The browser backend (canvas) is a separate module.
 */

import zlib from 'node:zlib';

const PNG_SIG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const typeBytes = Uint8Array.from(type, ch => ch.charCodeAt(0));
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    out.set(typeBytes, 4);
    out.set(data, 8);
    const crcInput = new Uint8Array(4 + data.length);
    crcInput.set(typeBytes, 0);
    crcInput.set(data, 4);
    dv.setUint32(8 + data.length, crc32(crcInput));
    return out;
}

/**
 * Encode an 8-bit RGB image as PNG bytes.
 *
 * @param {number} width - Image width.
 * @param {number} height - Image height.
 * @param {Uint8Array} rgb - width*height*3 RGB bytes.
 * @returns {Uint8Array} PNG file bytes.
 */
export function encodePngRgb(width, height, rgb) {
    const stride = width * 3;
    const raw = new Uint8Array((stride + 1) * height);
    for (let y = 0; y < height; y++) {
        raw[y * (stride + 1)] = 0; // per-row filter type 0 (none)
        raw.set(rgb.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1);
    }
    const idat = zlib.deflateSync(raw);

    const ihdr = new Uint8Array(13);
    const dv = new DataView(ihdr.buffer);
    dv.setUint32(0, width);
    dv.setUint32(4, height);
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 2;  // color type 2 = RGB
    // 10..12 = compression / filter / interlace = 0

    const parts = [PNG_SIG, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
        out.set(p, off);
        off += p.length;
    }
    return out;
}

/**
 * Create a Node {@link ImageBackend} backed by the PNG encoder above.
 *
 * @returns {{ composite(page: object): Promise<Uint8Array> }}
 */
export function createNodeImageBackend() {
    return {
        async composite({ width, height, glyphs }) {
            const rgb = new Uint8Array(width * height * 3); // black background
            for (const { x, y, bitmap } of glyphs) {
                const { width: gw, height: gh, data } = bitmap; // RGBA source
                for (let r = 0; r < gh; r++) {
                    const py = y + r;
                    if (py < 0 || py >= height) continue;
                    let di = r * gw * 4;
                    let pi = (py * width + x) * 3;
                    for (let c = 0; c < gw; c++, di += 4, pi += 3) {
                        const px = x + c;
                        if (px < 0 || px >= width) continue;
                        rgb[pi] = data[di];
                        rgb[pi + 1] = data[di + 1];
                        rgb[pi + 2] = data[di + 2];
                    }
                }
            }
            return encodePngRgb(width, height, rgb);
        }
    };
}
