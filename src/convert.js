/**
 * Core converter: turns per-glyph MSDF bitmaps + msdfgen metrics into a PlayCanvas
 * font asset (v3 JSON + atlas layout). Ported from the Editor pipeline
 * (playcanvas-monorepo .../font-convert/msdf-font-gen.js) and kept
 * environment-agnostic — image compositing/encoding is supplied by the caller.
 *
 * Units: upstream msdfgen emits metrics in EM units (1 em = 1.0). PlayCanvas font
 * data uses a 32-unit em, so glyph metrics are multiplied by {@link EM_TO_UNITS}.
 * opentype.js kerning is in font units, so it is scaled by EM_TO_UNITS / unitsPerEm.
 */

export const GLYPH_SIZE = 64; // msdfgen -size 64 64
export const PXRANGE = 8; // msdfgen -pxrange 8
export const PADDING = 1; // 1px gutter around each glyph in the atlas
export const MAX_TEXTURE = 4096;
export const EM_TO_UNITS = 32; // em (1.0) -> PlayCanvas 32-unit em

/**
 * The canonical per-glyph msdfgen invocation used by the Editor pipeline
 * (playcanvas-monorepo origin/main), which `@playcanvas/msdfgen-wasm` must replicate:
 *
 *   msdfgen -emnormalize -scale 32 -autoframe -size 64 64 -pxrange 8 -printmetrics \
 *           -o <png> -font <ttf> <codepoint>
 *
 * `-emnormalize` (an upstream msdfgen flag) makes glyph coords independent of the font's
 * unitsPerEm (1 unit = 1 em) — this is how upstream replaces the dead fork's import-font.cpp
 * patch. `-printmetrics` then reports bounds/advance/translate in em units, which we scale to
 * the 32-unit em via {@link EM_TO_UNITS}. Repo A must pin an upstream msdfgen with -emnormalize.
 */
export const MSDFGEN_ARGS = Object.freeze({
    emnormalize: true,
    scale: EM_TO_UNITS,
    autoframe: true,
    size: GLYPH_SIZE,
    pxrange: PXRANGE
});

/**
 * Compute the atlas layout: how many texture pages, their dimensions, and the
 * pixel placement of each glyph cell. Pure (no image work).
 *
 * Validated to reproduce the Editor's output exactly (see test/packing.test.mjs).
 *
 * @param {number} count - Number of glyph cells to place.
 * @param {object} [opts] - Overrides.
 * @param {number} [opts.glyphSize] - Cell size in px (default {@link GLYPH_SIZE}).
 * @param {number} [opts.padding] - Gutter in px (default {@link PADDING}).
 * @param {number} [opts.maxTexture] - Max page dimension (default {@link MAX_TEXTURE}).
 * @returns {{ maps: { width: number, height: number }[], placements: { x: number, y: number, width: number, height: number, map: number }[] }}
 */
export function packLayout(count, opts = {}) {
    const glyphSize = opts.glyphSize ?? GLYPH_SIZE;
    const padding = opts.padding ?? PADDING;
    const maxTexture = opts.maxTexture ?? MAX_TEXTURE;
    const paddedSize = glyphSize + 2 * padding;

    // capacity -> [width, height] for every power-of-two page up to maxTexture
    const combinations = {};
    for (let w = maxTexture; w >= 1; w /= 2) {
        for (let h = w; h >= w / 2 && h >= 1; h /= 2) {
            const capacity = Math.floor(w / paddedSize) * Math.floor(h / paddedSize);
            if (capacity <= 0) break;
            combinations[capacity] = [w, h];
        }
    }

    const capacities = Object.keys(combinations); // ascending numeric-string keys
    let optimize = true; // allow splitting into (at most) 2 smaller pages

    const maps = [];
    const placements = [];

    const next = (skip) => {
        let currentCapacity;
        for (let j = 0, len = capacities.length; j < len; j++) {
            currentCapacity = parseInt(capacities[j], 10);
            if (count - skip <= currentCapacity) break;
            if (j > 0 && optimize) {
                const prevCapacity = parseInt(capacities[j - 1], 10);
                if (count - skip <= currentCapacity + prevCapacity) {
                    optimize = false;
                    break;
                }
            }
        }

        const [w, h] = combinations[currentCapacity];
        const cols = Math.floor(w / paddedSize);
        const rows = Math.floor(h / paddedSize);

        const mapIndex = maps.length;
        maps.push({ width: w, height: h });

        const limit = Math.min(count, skip + cols * rows);
        let x = padding;
        let y = padding;
        for (let i = skip; i < limit; i++) {
            placements[i] = { x, y, width: glyphSize, height: glyphSize, map: mapIndex };
            x += paddedSize;
            if (x >= cols * paddedSize) {
                y += paddedSize;
                x = padding;
            }
        }

        if (limit < count) next(limit);
    };

    next(0);
    return { maps, placements };
}

/**
 * Scale a raw kerning table (font units, from opentype.js) into PlayCanvas's
 * 32-unit em space, keyed by left -> right codepoint.
 *
 * @param {{ left: number, right: number, value: number }[]} pairs - Raw pairs.
 * @param {number} unitsPerEm - The font's units-per-em.
 * @returns {Record<number, Record<number, number>>} Scaled kerning table.
 */
export function scaleKerning(pairs, unitsPerEm) {
    const s = EM_TO_UNITS / unitsPerEm;
    const out = {};
    for (const { left, right, value } of pairs) {
        if (!value) continue;
        (out[left] ??= {})[right] = value * s;
    }
    return out;
}

/**
 * Assemble the final v3 font JSON from packed placements + per-glyph msdfgen metrics.
 *
 * NOTE: the em->unit scaling (EM_TO_UNITS) and the handling of msdfgen's per-glyph
 * `scale`/autoframe are provisional and will be locked against the golden
 * examples/assets/fonts/arial.json once the WASM emits real upstream metrics.
 *
 * @param {object} args - Inputs.
 * @param {string} args.face - Font family name.
 * @param {number[]} args.codepoints - Codepoints, aligned with `glyphs` & `placements`.
 * @param {(null | { advance: number, translate: [number, number], range?: number, bounds?: number[] })[]} args.glyphs - Per-glyph metrics in raw EM units (null = glyph absent). `range` is the em range-width (upper − lower).
 * @param {{ x: number, y: number, width: number, height: number, map: number }[]} args.placements - Atlas placements.
 * @param {{ width: number, height: number }[]} args.maps - Atlas page dimensions.
 * @param {Record<number, Record<number, number>>} [args.kerning] - Scaled kerning table.
 * @param {number} [args.intensity] - SDF intensity (default 0).
 * @returns {object} The v3 font data.
 */
export function assembleFontData({ face, codepoints, glyphs, placements, maps, kerning, intensity = 0 }) {
    const data = {
        version: 3,
        type: 'msdf',
        intensity,
        info: { face, maps },
        chars: {},
        kerning: kerning ?? {}
    };

    for (let i = 0; i < codepoints.length; i++) {
        const g = glyphs[i];
        const p = placements[i];
        if (!g || !p) continue;

        const cp = codepoints[i];
        const letter = String.fromCodePoint(cp);
        data.chars[letter] = {
            id: cp,
            letter,
            x: p.x,
            y: p.y,
            width: p.width,
            height: p.height,
            map: p.map,
            xadvance: g.advance * EM_TO_UNITS,
            xoffset: g.translate[0] * EM_TO_UNITS,
            yoffset: g.translate[1] * EM_TO_UNITS,
            scale: 1,
            ...(g.range != null ? { range: g.range * EM_TO_UNITS } : {}),
            ...(g.bounds ? { bounds: g.bounds.map(v => v * EM_TO_UNITS) } : {})
        };
    }

    return data;
}
