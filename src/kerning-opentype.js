/**
 * opentype.js-backed kerning source. Ported from the Editor pipeline
 * (playcanvas-monorepo .../msdf-font-gen.js extractKerningTable).
 *
 * Returns raw font-unit kerning pairs; generateFont scales them into the 32-unit em
 * space via scaleKerning (× 32 / unitsPerEm). Works in Node and the browser
 * (opentype.parse takes an ArrayBuffer); import via the "./kerning-opentype" subpath
 * so the package root stays free of the opentype.js dependency.
 */

import opentype from 'opentype.js';

/**
 * Create a {@link KerningSource} from a font file buffer.
 *
 * @param {ArrayBuffer | Uint8Array} fontBuffer - The TTF/OTF bytes.
 * @returns {(codepoints: number[]) => Promise<{ pairs: { left: number, right: number, value: number }[], unitsPerEm: number }>}
 */
export function opentypeKerningSource(fontBuffer) {
    const ab = fontBuffer instanceof Uint8Array
        ? fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength)
        : fontBuffer;
    const font = opentype.parse(ab);

    return async (codepoints) => {
        const pairs = [];
        for (let l = 0; l < codepoints.length; l++) {
            const leftIdx = font.charToGlyphIndex(String.fromCodePoint(codepoints[l]));
            for (let r = 0; r < codepoints.length; r++) {
                if (l === r) continue;
                const value = font.getKerningValue(
                    leftIdx,
                    font.charToGlyphIndex(String.fromCodePoint(codepoints[r]))
                );
                if (value) pairs.push({ left: codepoints[l], right: codepoints[r], value });
            }
        }
        return { pairs, unitsPerEm: font.unitsPerEm };
    };
}
