/**
 * fontkit-backed kerning source. fontkit runs the full OpenType GPOS engine, so it resolves
 * class-based kerning — used by virtually all modern fonts (e.g. Arial) — that opentype.js's
 * getKerningValue cannot. Returns raw font-unit pairs; generateFont scales them into the
 * 32-unit em space (× 32 / unitsPerEm).
 *
 * Node-oriented (fontkit.create takes a Buffer). The browser tool can inject a different
 * kerning source. Import via the "./kerning-fontkit" subpath so the package root stays free
 * of the fontkit dependency.
 */

import * as fontkit from 'fontkit';

/**
 * Create a {@link KerningSource} from a font file buffer.
 *
 * @param {ArrayBuffer | Uint8Array | Buffer} fontBuffer - The TTF/OTF bytes.
 * @returns {(codepoints: number[]) => Promise<{ pairs: { left: number, right: number, value: number }[], unitsPerEm: number }>}
 */
export function fontkitKerningSource(fontBuffer) {
    const font = fontkit.create(Buffer.from(fontBuffer));

    return async (codepoints) => {
        const chars = codepoints.map(cp => String.fromCodePoint(cp));
        const pairs = [];
        for (let l = 0; l < codepoints.length; l++) {
            for (let r = 0; r < codepoints.length; r++) {
                if (l === r) continue;
                const run = font.layout(chars[l] + chars[r]);
                // A pair kern is the GPOS adjustment to the first glyph's advance. Skip
                // ligatures/substitutions (the run would not be exactly two glyphs).
                if (run.glyphs.length !== 2) continue;
                const value = run.positions[0].xAdvance - run.glyphs[0].advanceWidth;
                if (value) pairs.push({ left: codepoints[l], right: codepoints[r], value });
            }
        }
        return { pairs, unitsPerEm: font.unitsPerEm };
    };
}
