import * as pc from 'playcanvas';

import { generateFont, CHARSETS } from '@playcanvas/font-tools';
import { createCanvasImageBackend } from '@playcanvas/font-tools/image-backend-canvas';
import { createMsdfgenGlyphSource } from '@playcanvas/font-tools/glyph-source-msdfgen';
// The .wasm is copied into public/ at (pre)build time (copy-wasm.mjs) and served at the app's
// base URL; hand its absolute URL to Emscripten's locateFile. (A ?url import of a dependency's
// wasm subpath resolves in `vite dev` but fails Rollup in production builds.)
const wasmUrl = new URL(`${import.meta.env.BASE_URL}msdfgen.wasm`, window.location.href).href;

const $ = id => document.getElementById(id);

for (const name of Object.keys(CHARSETS)) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    $('charset').appendChild(opt);
}
$('charset').value = 'latin';

let fontBytes = null;
let fontName = 'font';
let app = null;
let textEl = null;

$('file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    fontBytes = new Uint8Array(await file.arrayBuffer());
    fontName = file.name.replace(/\.[^.]+$/, '') || 'font';
    $('status').textContent = `Loaded ${file.name} (${(fontBytes.length / 1024) | 0} KB)`;
    $('go').disabled = false;
});

function setDownload(id, name, blob) {
    const a = $(id);
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.textContent = `↓ ${name}`;
    a.style.display = 'inline';
}

// --- live engine preview ---

async function ensureApp() {
    if (app) return;
    const canvas = $('preview');
    // give the canvas a real backbuffer size before device creation (avoids 0-size init)
    canvas.width = canvas.clientWidth || 900;
    canvas.height = canvas.clientHeight || 360;
    const device = await pc.createGraphicsDevice(canvas, { deviceTypes: ['webgpu', 'webgl2'] });
    const opts = new pc.AppOptions();
    opts.graphicsDevice = device;
    opts.componentSystems = [pc.CameraComponentSystem, pc.ScreenComponentSystem, pc.ElementComponentSystem];
    opts.resourceHandlers = [];

    app = new pc.AppBase(canvas);
    app.init(opts);
    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    app.start();
    window.addEventListener('resize', () => app.resizeCanvas());

    const camera = new pc.Entity();
    camera.addComponent('camera', { clearColor: new pc.Color(0.08, 0.08, 0.08) });
    app.root.addChild(camera);

    const screen = new pc.Entity();
    // 1:1 pixel mapping — avoids any reference-resolution scale division
    screen.addComponent('screen', { screenSpace: true, scaleMode: pc.SCALEMODE_NONE });
    app.root.addChild(screen);

    textEl = new pc.Entity();
    textEl.addComponent('element', {
        type: pc.ELEMENTTYPE_TEXT,
        pivot: new pc.Vec2(0.5, 0.5),
        anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
        fontSize: 64,
        autoWidth: true,
        autoHeight: true,
        text: ''
    });
    screen.addChild(textEl);
}

async function buildFont(data, textures) {
    const pcTextures = await Promise.all(textures.map(async (png) => {
        const bitmap = await createImageBitmap(new Blob([png], { type: 'image/png' }));
        const texture = new pc.Texture(app.graphicsDevice, {
            name: 'msdf-atlas',
            width: bitmap.width,
            height: bitmap.height,
            // MSDF stores a distance field, not color — sample it LINEARLY (sRGB decode would
            // gamma-shift the median below the 0.5 edge and make every glyph transparent).
            format: pc.PIXELFORMAT_RGBA8,
            mipmaps: true,
            minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
            magFilter: pc.FILTER_LINEAR,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE,
            levels: [bitmap]
        });
        texture.upload();
        return texture;
    }));
    return new pc.Font(pcTextures, data);
}

function hexToColor(hex) {
    const n = parseInt(hex.slice(1), 16);
    return new pc.Color(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function updatePreview() {
    if (!textEl) return;
    textEl.element.text = $('ptext').value || ' ';
    textEl.element.fontSize = parseInt($('psize').value, 10) || 64;
    textEl.element.color = hexToColor($('pcolor').value);
}
['ptext', 'psize', 'pcolor'].forEach(id => $(id).addEventListener('input', updatePreview));

// --- generate ---

$('go').addEventListener('click', async () => {
    if (!fontBytes) return;
    $('go').disabled = true;
    $('status').textContent = 'Generating…';
    try {
        const glyphSource = await createMsdfgenGlyphSource(fontBytes, {
            moduleOverrides: { locateFile: p => (p.endsWith('.wasm') ? wasmUrl : p) }
        });
        const { data, textures } = await generateFont({
            chars: $('charset').value,
            fontName,
            size: parseInt($('size').value, 10) || 64,
            glyphSource,
            imageBackend: createCanvasImageBackend()
        });
        glyphSource.dispose?.();

        // atlas (page 0)
        const pngBlob = new Blob([textures[0]], { type: 'image/png' });
        const img = new Image();
        img.onload = () => {
            const c = $('atlas');
            c.width = img.width;
            c.height = img.height;
            c.getContext('2d').drawImage(img, 0, 0);
        };
        img.src = URL.createObjectURL(pngBlob);

        setDownload('dl-json', `${fontName}.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
        setDownload('dl-png', `${fontName}.png`, pngBlob);

        // live engine preview
        await ensureApp();
        textEl.element.font = await buildFont(data, textures);
        updatePreview();
        $('preview-hint').style.display = 'none';

        $('status').textContent = `Done — ${Object.keys(data.chars).length} glyphs, ${data.info.maps.length} page(s).`;
    } catch (err) {
        console.error(err);
        $('status').textContent = `Error: ${err.message}`;
    } finally {
        $('go').disabled = false;
    }
});
