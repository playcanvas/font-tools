/**
 * Live PlayCanvas preview: a lazily-created AppBase rendering a single screen-space text
 * element. The font/atlas are built into real pc.Texture + pc.Font objects so what you see is
 * exactly what the engine renders. Background can be swapped (dark / light / checker) to judge
 * legibility — checker relies on an alpha-clearing camera so the CSS pattern shows through.
 */

import * as pc from 'playcanvas';

const BACKGROUNDS = {
    dark: { color: new pc.Color(0.08, 0.08, 0.08, 1), cls: '' },
    light: { color: new pc.Color(0.86, 0.86, 0.86, 1), cls: 'bg-light' },
    checker: { color: new pc.Color(0, 0, 0, 0), cls: 'bg-checker' }
};

function hexToColor(hex) {
    const n = parseInt(hex.slice(1), 16);
    return new pc.Color(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * @param {object} refs
 * @param {HTMLCanvasElement} refs.canvas - The preview canvas (#preview).
 * @param {HTMLElement} refs.wrap - The wrapper that carries the background class (#preview-wrap).
 */
export function createPreview({ canvas, wrap }) {
    let app = null;
    let textEl = null;
    let camera = null;
    let bgMode = 'dark';
    let last = { text: 'Hello PlayCanvas', size: 64, color: '#ffffff' };

    async function ensureApp() {
        if (app) return;
        // give the canvas a real backbuffer size before device creation (avoids 0-size init)
        canvas.width = canvas.clientWidth || 900;
        canvas.height = canvas.clientHeight || 360;
        const device = await pc.createGraphicsDevice(canvas, { deviceTypes: ['webgpu', 'webgl2'], alpha: true });
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

        camera = new pc.Entity();
        camera.addComponent('camera', { clearColor: BACKGROUNDS[bgMode].color });
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

    function setFont(font) {
        if (textEl) textEl.element.font = font;
    }

    function update(params) {
        if (params) last = { ...last, ...params };
        if (!textEl) return;
        textEl.element.text = last.text || ' ';
        textEl.element.fontSize = parseInt(last.size, 10) || 64;
        textEl.element.color = hexToColor(last.color);
    }

    function setBackground(mode) {
        bgMode = BACKGROUNDS[mode] ? mode : 'dark';
        wrap.classList.remove('bg-light', 'bg-checker');
        if (BACKGROUNDS[bgMode].cls) wrap.classList.add(BACKGROUNDS[bgMode].cls);
        if (camera) camera.camera.clearColor = BACKGROUNDS[bgMode].color;
    }

    return { ensureApp, buildFont, setFont, update, setBackground };
}
