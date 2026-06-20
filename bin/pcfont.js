#!/usr/bin/env node
/**
 * pcfont — generate a PlayCanvas MSDF font (JSON + atlas PNG) from a TTF/OTF.
 *
 *   npx @playcanvas/font-tools MyFont.ttf --charset latin-ext --size 42 -o assets/fonts/myfont
 *
 * Writes <out>.json and <out>.png (+ <out>1.png, <out>2.png ... for multi-page atlases),
 * which load directly as a PlayCanvas 'font' asset.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, basename, extname } from 'node:path';

import { generateFont } from '../src/index.js';
import { createNodeImageBackend } from '../src/image-backend-node.js';
import { createMsdfgenGlyphSource } from '../src/glyph-source-msdfgen.js';
import { fontkitKerningSource } from '../src/kerning-fontkit.js';

const HELP = `pcfont — generate a PlayCanvas MSDF font from a TTF/OTF

Usage:
  pcfont <font.ttf> [options]

Options:
  -o, --out <path>     Output base path (writes <path>.json + <path>.png). Default: font name.
      --charset <spec> Preset (ascii, latin, latin-ext, cyrillic, greek) or literal chars. Default: ascii.
      --size <px>      Glyph cell size. Default: 64.
      --pxrange <px>   MSDF distance range. Default: 8.
      --intensity <n>  SDF intensity. Default: 0.
      --name <face>    Face name written into the JSON. Default: output/font base name.
      --invert         Invert glyph winding (for fonts with inverted contours).
      --no-kerning     Skip kerning extraction.
  -h, --help           Show this help.
`;

function parseArgs(argv) {
    const o = { charset: 'ascii', size: 64, pxrange: 8, intensity: 0, invert: false, kerning: true };
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        switch (a) {
            case '-o': case '--out': o.out = argv[++i]; break;
            case '--charset': o.charset = argv[++i]; break;
            case '--size': o.size = parseInt(argv[++i], 10); break;
            case '--pxrange': o.pxrange = parseFloat(argv[++i]); break;
            case '--intensity': o.intensity = parseFloat(argv[++i]); break;
            case '--name': o.name = argv[++i]; break;
            case '--invert': o.invert = true; break;
            case '--no-kerning': o.kerning = false; break;
            case '-h': case '--help': o.help = true; break;
            default:
                if (a.startsWith('-')) { console.error(`pcfont: unknown option '${a}'`); process.exit(1); }
                positional.push(a);
        }
    }
    o.font = positional[0];
    return o;
}

async function main() {
    const o = parseArgs(process.argv.slice(2));
    if (o.help || !o.font) {
        console.log(HELP);
        process.exit(o.font ? 0 : 1);
    }

    const ttf = new Uint8Array(readFileSync(o.font));
    const outBase = o.out || basename(o.font, extname(o.font));
    const face = o.name || basename(outBase, extname(outBase));

    const glyphSource = await createMsdfgenGlyphSource(ttf);
    const { data, textures } = await generateFont({
        chars: o.charset,
        fontName: face,
        intensity: o.intensity,
        invert: o.invert,
        size: o.size,
        pxrange: o.pxrange,
        glyphSource,
        imageBackend: createNodeImageBackend(),
        kerningSource: o.kerning ? fontkitKerningSource(ttf) : null
    });
    glyphSource.dispose?.();

    const dir = dirname(outBase);
    if (dir && dir !== '.') mkdirSync(dir, { recursive: true });

    writeFileSync(`${outBase}.json`, JSON.stringify(data));
    const files = [`${outBase}.json`];
    textures.forEach((png, i) => {
        const p = i === 0 ? `${outBase}.png` : `${outBase}${i}.png`;
        writeFileSync(p, png);
        files.push(p);
    });

    console.log(`pcfont: ${Object.keys(data.chars).length} glyphs, ${data.info.maps.length} atlas page(s)`);
    for (const f of files) console.log(`  wrote ${f}`);
}

main().catch((err) => {
    console.error('pcfont:', err.message);
    process.exit(1);
});
