/**
 * generateFont — orchestrates a full PlayCanvas MSDF font build from a glyph source
 * and an image backend, both dependency-injected so the same code runs in Node and the
 * browser (and is testable without the WASM core).
 *
 *   glyphSource  — produces a per-glyph MSDF bitmap + em-unit metrics (backed by
 *                  @playcanvas/msdfgen-wasm in production).
 *   imageBackend — composites glyph bitmaps into atlas pages and encodes PNG bytes
 *                  (canvas in the browser, a pure-JS PNG encoder in Node).
 *   kerningSource — optional; returns raw font-unit kerning pairs + unitsPerEm
 *                  (see ./kerning-opentype.js).
 */

import { packLayout, assembleFontData, scaleKerning, GLYPH_SIZE, PXRANGE } from './convert.js';
import { resolveCharset } from './charsets.js';

/**
 * @typedef {{ width: number, height: number, data: Uint8ClampedArray }} GlyphBitmap - RGBA pixels.
 * @typedef {{ advance: number, translate: [number, number], bounds?: number[], range?: number }} GlyphMetrics - em units.
 * @typedef {{ bitmap: GlyphBitmap, metrics: GlyphMetrics }} Glyph
 * @typedef {{ generateGlyph(codepoint: number, opts: { size: number, pxrange: number }): Promise<Glyph | null> }} GlyphSource
 * @typedef {{ composite(page: { width: number, height: number, glyphs: { x: number, y: number, bitmap: GlyphBitmap }[] }): Promise<Uint8Array> }} ImageBackend
 * @typedef {(codepoints: number[]) => Promise<{ pairs: { left: number, right: number, value: number }[], unitsPerEm: number }>} KerningSource
 */

// codepoints with no ink — never inverted (negating an empty field would fill the cell)
const WHITESPACE = new Set([0x20, 0x09, 0x0a, 0x0d, 0xa0]);

/**
 * Build a PlayCanvas font asset (v3 JSON + atlas PNG bytes) from a TTF/OTF.
 *
 * @param {object} opts - Options.
 * @param {string | number[]} [opts.chars] - Charset preset name, literal string, or codepoints.
 * @param {string} [opts.fontName] - Face name written into the JSON.
 * @param {number} [opts.intensity] - SDF intensity (default 0).
 * @param {boolean} [opts.invert] - Negate glyph RGB (for fonts with inverted winding).
 * @param {GlyphSource} opts.glyphSource - Required per-glyph MSDF generator.
 * @param {ImageBackend} opts.imageBackend - Required atlas compositor/encoder.
 * @param {KerningSource} [opts.kerningSource] - Optional kerning provider.
 * @param {number} [opts.size] - Glyph cell size in px (default {@link GLYPH_SIZE}).
 * @param {number} [opts.pxrange] - MSDF pixel range (default {@link PXRANGE}).
 * @returns {Promise<{ data: object, textures: Uint8Array[] }>} The font JSON and one PNG per atlas page.
 */
export async function generateFont({
    chars = 'ascii',
    fontName = 'font',
    intensity = 0,
    invert = false,
    glyphSource,
    imageBackend,
    kerningSource = null,
    size = GLYPH_SIZE,
    pxrange = PXRANGE
}) {
    if (!glyphSource) throw new Error('generateFont: `glyphSource` is required');
    if (!imageBackend) throw new Error('generateFont: `imageBackend` is required');

    const codepoints = resolveCharset(chars);

    // 1) generate each glyph; keep only those the font actually provides
    const present = [];
    for (const cp of codepoints) {
        const glyph = await glyphSource.generateGlyph(cp, { size, pxrange });
        if (!glyph) continue;
        if (invert && !WHITESPACE.has(cp)) negateRgb(glyph.bitmap);
        present.push({ cp, glyph });
    }

    // 2) pack into atlas page(s)
    const { maps, placements } = packLayout(present.length, { glyphSize: size });

    // 3) composite + encode one PNG per page
    const textures = [];
    for (let page = 0; page < maps.length; page++) {
        const glyphs = [];
        for (let i = 0; i < present.length; i++) {
            if (placements[i].map !== page) continue;
            glyphs.push({ x: placements[i].x, y: placements[i].y, bitmap: present[i].glyph.bitmap });
        }
        textures.push(await imageBackend.composite({ width: maps[page].width, height: maps[page].height, glyphs }));
    }

    // 4) kerning (optional)
    let kerning = {};
    if (kerningSource) {
        const { pairs, unitsPerEm } = await kerningSource(present.map(e => e.cp));
        kerning = scaleKerning(pairs, unitsPerEm);
    }

    // 5) assemble v3 JSON
    const data = assembleFontData({
        face: fontName,
        codepoints: present.map(e => e.cp),
        glyphs: present.map(e => e.glyph.metrics),
        placements,
        maps,
        kerning,
        intensity
    });

    return { data, textures };
}

/**
 * Negate the RGB channels of an RGBA bitmap in place (alpha untouched).
 *
 * @param {GlyphBitmap} bitmap - The bitmap to invert.
 */
function negateRgb(bitmap) {
    const d = bitmap.data;
    for (let i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
    }
}
