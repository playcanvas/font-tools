# @playcanvas/font-tools

Generate [PlayCanvas](https://playcanvas.com) **MSDF font assets** (JSON + atlas PNG) from a TTF/OTF — in **Node or the browser**, with no Editor and no native binaries. Glyph generation is powered by [`@playcanvas/msdfgen-wasm`](https://github.com/playcanvas/msdfgen-wasm) (upstream msdfgen compiled to WebAssembly).

Output matches the PlayCanvas Editor's format exactly — validated to **0.000 metric error** against the engine's golden `arial.json`.

Three ways to use it: the **hosted web app**, the **`pcfont` CLI**, or the **JavaScript API**.

## Web app

No install — generate fonts in your browser at **<https://playcanvas.github.io/font-tools/>**: drop in a TTF/OTF, pick a character set and size, **preview it live in a real PlayCanvas text element**, then download the JSON + atlas. Everything runs client-side — your font is never uploaded.

## CLI

```bash
npx @playcanvas/font-tools MyFont.ttf --charset latin-ext --size 42 -o assets/fonts/myfont
```

Writes `myfont.json` + `myfont.png` (`myfont1.png`, … for multi-page atlases), which load directly as a PlayCanvas `font` asset.

| Option | Default | |
|---|---|---|
| `-o, --out <path>` | font name | Output base path (`<path>.json` + `<path>.png`) |
| `--charset <spec>` | `ascii` | Preset (`ascii`, `latin`, `latin-ext`, `cyrillic`, `greek`) or literal chars |
| `--size <px>` | `64` | Glyph cell size |
| `--pxrange <px>` | `8` | MSDF distance range |
| `--intensity <n>` | `0` | SDF intensity |
| `--name <face>` | out/font base | Face name in the JSON |
| `--invert` | off | Invert glyph winding |
| `--no-kerning` | — | Skip kerning extraction |

## API

```js
import { generateFont } from '@playcanvas/font-tools';
import { createNodeImageBackend } from '@playcanvas/font-tools/image-backend-node';
import { createMsdfgenGlyphSource } from '@playcanvas/font-tools/glyph-source-msdfgen';
import { fontkitKerningSource } from '@playcanvas/font-tools/kerning-fontkit';

const ttf = new Uint8Array(/* TTF/OTF bytes */);
const { data, textures } = await generateFont({
    chars: 'latin-ext',
    fontName: 'MyFont',
    glyphSource: await createMsdfgenGlyphSource(ttf),
    imageBackend: createNodeImageBackend(),     // browser backend uses canvas
    kerningSource: fontkitKerningSource(ttf)
});
// data    -> font JSON (v3); textures -> one PNG (Uint8Array) per atlas page
```

`generateFont` is dependency-injected — the **glyph source** (msdfgen WASM) and **image backend** are pluggable, so the same pipeline runs in Node and the browser. Use `createNodeImageBackend` (`@playcanvas/font-tools/image-backend-node`) in Node, or `createCanvasImageBackend` (`@playcanvas/font-tools/image-backend-canvas`) in the browser. The pure converter (`packLayout`, `assembleFontData`, `scaleKerning`) lives in `src/convert.js`.

## License

MIT
