/**
 * @playcanvas/font-tools — generate PlayCanvas MSDF font assets from TTF/OTF.
 *
 * Status: scaffolding. The pure converter (packing/assembly/charsets) is in place
 * and validated against the engine's golden arial.json. The live `generateFont`
 * entry point is pending the `@playcanvas/msdfgen-wasm` core (Repo A) and an
 * injectable image backend (canvas in the browser, sharp/pngjs in Node).
 */

export {
    GLYPH_SIZE,
    PXRANGE,
    PADDING,
    MAX_TEXTURE,
    EM_TO_UNITS,
    MSDFGEN_ARGS,
    packLayout,
    scaleKerning,
    assembleFontData
} from './convert.js';

export { CHARSETS, expandRanges, resolveCharset } from './charsets.js';

export { generateFont } from './generate.js';
