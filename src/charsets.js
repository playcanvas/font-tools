/**
 * Charset presets, mirroring the ranges offered by the Editor's font inspector.
 * A charset spec is resolved to a sorted, de-duplicated array of codepoints.
 */

/** @type {Record<string, [number, number][]>} preset name -> inclusive codepoint ranges */
export const CHARSETS = {
    // Basic Latin (printable ASCII)
    'ascii': [[0x20, 0x7e]],
    'latin': [[0x20, 0x7e]],
    // + Latin-1 Supplement + Latin Extended-A
    'latin-ext': [[0x20, 0x7e], [0xa0, 0xff], [0x100, 0x17f]],
    'cyrillic': [[0x20, 0x7e], [0x400, 0x4ff]],
    'greek': [[0x20, 0x7e], [0x370, 0x3ff]]
};

/**
 * Expand inclusive [lo, hi] codepoint ranges to a flat codepoint array.
 *
 * @param {[number, number][]} ranges - The ranges to expand.
 * @returns {number[]} The codepoints.
 */
export function expandRanges(ranges) {
    const out = [];
    for (const [lo, hi] of ranges) {
        for (let cp = lo; cp <= hi; cp++) out.push(cp);
    }
    return out;
}

/**
 * Resolve a charset spec to a sorted, de-duplicated codepoint array.
 *
 * @param {string | number[]} spec - A preset name, a literal string of characters,
 * or an explicit array of codepoints.
 * @returns {number[]} Sorted, unique codepoints.
 */
export function resolveCharset(spec) {
    let cps;
    if (typeof spec === 'string') {
        cps = CHARSETS[spec] ? expandRanges(CHARSETS[spec]) : Array.from(spec, c => c.codePointAt(0));
    } else if (Array.isArray(spec)) {
        cps = spec.slice();
    } else {
        cps = expandRanges(CHARSETS.ascii);
    }
    return Array.from(new Set(cps)).sort((a, b) => a - b);
}
