// Parity test: the ported packing logic must reproduce the Editor's output.
// Validates src/convert.js packLayout against the engine's golden arial.json.
// No msdfgen/WASM needed.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

import { packLayout } from '../src/convert.js';
import { resolveCharset } from '../src/charsets.js';

// golden reference vendored from the engine (examples/assets/fonts/arial.json)
const ARIAL = new URL('./fixtures/arial.json', import.meta.url);
const arial = JSON.parse(readFileSync(ARIAL, 'utf8'));

// codepoints in the numeric-sort order the Editor feeds them
const codepoints = Object.keys(arial.chars)
    .map(k => arial.chars[k].id)
    .sort((a, b) => a - b);

const { maps, placements } = packLayout(codepoints.length);

// 1) atlas pages match
assert.deepStrictEqual(maps, arial.info.maps, 'info.maps mismatch');

// 2) every glyph's placement matches
codepoints.forEach((cp, i) => {
    const got = placements[i];
    const want = arial.chars[String(cp)];
    assert.ok(got, `missing placement for cp ${cp}`);
    assert.strictEqual(got.x, want.x, `x mismatch for '${want.letter}'`);
    assert.strictEqual(got.y, want.y, `y mismatch for '${want.letter}'`);
    assert.strictEqual(got.map, want.map, `map mismatch for '${want.letter}'`);
    assert.strictEqual(got.width, want.width, `width mismatch for '${want.letter}'`);
    assert.strictEqual(got.height, want.height, `height mismatch for '${want.letter}'`);
});

// 3) charset presets resolve sanely
assert.deepStrictEqual(resolveCharset('ascii').slice(0, 3), [0x20, 0x21, 0x22], 'ascii preset');
assert.strictEqual(resolveCharset('Hello').length, 4, 'literal string -> unique codepoints (H,e,l,o)');

console.log(`OK — packing parity over ${codepoints.length} glyphs; charset presets resolve.`);
