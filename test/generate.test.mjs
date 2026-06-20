// generateFont orchestration test — uses mock glyph source + image backend (no WASM,
// no image libs). Verifies: missing-glyph filtering, packing, per-page compositing,
// em->unit metric scaling, and kerning scaling.

import assert from 'node:assert';
import { generateFont } from '../src/generate.js';

const EM = 32;

const mockGlyphSource = {
    async generateGlyph(cp) {
        if (cp === 0x99) return null; // font lacks this glyph
        return {
            bitmap: { width: 4, height: 4, data: new Uint8ClampedArray(4 * 4 * 4).fill(128) },
            metrics: { advance: 0.5, translate: [0.1, 0.7], bounds: [0, 0, 0.5, 0.7], range: 0.25 }
        };
    }
};

const composited = [];
const mockImageBackend = {
    async composite(page) {
        composited.push(page);
        // encode [w & 0xff, h & 0xff, glyphCount] so the test can assert
        return new Uint8Array([page.width & 0xff, page.height & 0xff, page.glyphs.length]);
    }
};

const mockKerningSource = async () => ({
    pairs: [{ left: 0x41, right: 0x56, value: -100 }], // A -> V, in font units
    unitsPerEm: 1000
});

const { data, textures } = await generateFont({
    chars: [0x41, 0x56, 0x99], // A, V, and one the "font" lacks
    fontName: 'mock',
    glyphSource: mockGlyphSource,
    imageBackend: mockImageBackend,
    kerningSource: mockKerningSource
});

// schema + filtering
assert.strictEqual(data.version, 3);
assert.strictEqual(data.type, 'msdf');
assert.strictEqual(Object.keys(data.chars).length, 2, 'missing glyph (0x99) filtered out');
assert.ok(data.chars.A && data.chars.V, 'chars keyed by letter');

// em -> 32-unit scaling
assert.strictEqual(data.chars.A.xadvance, 0.5 * EM, 'advance scaled');
assert.deepStrictEqual([data.chars.A.xoffset, data.chars.A.yoffset], [0.1 * EM, 0.7 * EM], 'translate scaled');
assert.deepStrictEqual(data.chars.A.bounds, [0, 0, 0.5 * EM, 0.7 * EM], 'bounds scaled');
assert.strictEqual(data.chars.A.scale, 1, 'scale is 1');

// kerning scaled by 32 / unitsPerEm (computed the same way as scaleKerning to avoid ULP drift)
assert.strictEqual(data.kerning[0x41][0x56], -100 * (EM / 1000), 'kerning scaled');

// textures: one PNG per atlas page; both glyphs on the single page
assert.strictEqual(textures.length, data.info.maps.length, 'one texture per page');
assert.strictEqual(textures.length, 1, 'fits a single page');
assert.strictEqual(textures[0][2], 2, 'page composited both glyphs');

console.log('OK — generateFont: filtering, packing, compositing, scaling, kerning.');
