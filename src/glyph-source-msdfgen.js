/**
 * Adapts @playcanvas/msdfgen-wasm into a font-tools GlyphSource. Imported via the
 * "./glyph-source-msdfgen" subpath so the package root stays free of the WASM dependency.
 */

import { createMsdfgen } from '@playcanvas/msdfgen-wasm';

/**
 * Create a {@link GlyphSource} that renders glyphs via the msdfgen WASM core.
 *
 * @param {ArrayBuffer | Uint8Array} fontBytes - The TTF/OTF bytes.
 * @param {object} [opts] - Passed to createMsdfgen (e.g. { wasmUrl }).
 * @returns {Promise<{ generateGlyph: Function, dispose: Function }>}
 */
export async function createMsdfgenGlyphSource(fontBytes, opts = {}) {
    const msdfgen = await createMsdfgen(opts);
    const bytes = fontBytes instanceof Uint8Array ? fontBytes : new Uint8Array(fontBytes);
    const font = msdfgen.loadFont(bytes);

    return {
        generateGlyph(codepoint, { size, pxrange }) {
            const g = font.generateGlyph(codepoint, size, pxrange);
            if (!g) return null;
            return {
                bitmap: { width: g.width, height: g.height, data: g.rgba },
                metrics: {
                    advance: g.advance,
                    translate: [g.translateX, g.translateY],
                    bounds: [g.boundsL, g.boundsB, g.boundsR, g.boundsT],
                    range: g.range
                }
            };
        },
        dispose() {
            font.delete?.();
        }
    };
}
