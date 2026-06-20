/**
 * Generation pipeline wiring: reads the controls, runs generateFont with a determinate progress
 * bar (yielding so the main-thread glyph loop can repaint), renders the atlas with per-page tabs,
 * and exposes styled multi-page downloads. Kerning is loaded lazily and degrades gracefully.
 */

import { generateFont } from '@playcanvas/font-tools';
import { createCanvasImageBackend } from '@playcanvas/font-tools/image-backend-canvas';
import { createMsdfgenGlyphSource } from '@playcanvas/font-tools/glyph-source-msdfgen';

// The .wasm is copied into public/ at (pre)build time (copy-wasm.mjs) and served at the app's
// base URL; hand its absolute URL to Emscripten's locateFile. (A ?url import of a dependency's
// wasm subpath resolves in `vite dev` but fails Rollup in production builds.)
const wasmUrl = new URL(`${import.meta.env.BASE_URL}msdfgen.wasm`, window.location.href).href;

const $ = id => document.getElementById(id);

function fmtSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function initGenerate({ state, controls, preview }) {
    const go = $('go');
    const status = $('status');
    const progress = $('progress');
    const fill = $('progress-fill');
    const plabel = $('progress-label');
    const downloads = $('downloads');
    const atlasTabs = $('atlas-tabs');
    const atlasCanvas = $('atlas');
    const atlasMeta = $('atlas-meta');
    const emptyState = $('empty-state');

    let urls = [];
    let atlasBitmaps = [];
    let yielded = 0;

    function setStatus(msg, kind) {
        status.textContent = msg;
        status.className = kind ? `is-${kind}` : '';
    }

    function revokeUrls() {
        urls.forEach(u => URL.revokeObjectURL(u));
        urls = [];
    }

    // The glyph loop is a tight await chain that wouldn't otherwise yield a frame; pause briefly
    // every few glyphs so the bar actually animates.
    async function onProgress(p) {
        if (p.stage === 'glyphs') {
            progress.classList.remove('indeterminate');
            fill.style.width = `${p.total ? Math.round((p.done / p.total) * 100) : 0}%`;
            plabel.textContent = `Generating glyphs… ${p.done} / ${p.total}`;
            if (p.done - yielded >= 6 || p.done === p.total) {
                yielded = p.done;
                await new Promise(r => setTimeout(r, 0));
            }
        } else if (p.stage === 'pack') {
            plabel.textContent = 'Packing atlas…';
        } else if (p.stage === 'composite') {
            plabel.textContent = `Encoding atlas… ${p.done} / ${p.total}`;
        } else if (p.stage === 'kerning') {
            progress.classList.add('indeterminate');
            fill.style.width = '';
            plabel.textContent = 'Extracting kerning…';
            await new Promise(r => setTimeout(r, 0));
        }
    }

    function drawAtlasPage(i) {
        const bmp = atlasBitmaps[i];
        if (!bmp) return;
        atlasCanvas.width = bmp.width;
        atlasCanvas.height = bmp.height;
        atlasCanvas.getContext('2d').drawImage(bmp, 0, 0);
        [...atlasTabs.children].forEach((b, j) => b.classList.toggle('active', j === i));
    }

    async function renderAtlas(textures, maps) {
        atlasBitmaps = await Promise.all(textures.map(png => createImageBitmap(new Blob([png], { type: 'image/png' }))));
        atlasMeta.textContent = `MSDF atlas · ${maps[0].width}×${maps[0].height} · ${maps.length} page${maps.length === 1 ? '' : 's'}`;
        atlasTabs.innerHTML = '';
        if (maps.length > 1) {
            atlasTabs.style.display = 'flex';
            maps.forEach((_, i) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.textContent = `Page ${i + 1}`;
                b.addEventListener('click', () => drawAtlasPage(i));
                atlasTabs.appendChild(b);
            });
        } else {
            atlasTabs.style.display = 'none';
        }
        drawAtlasPage(0);
    }

    function addDownload(name, blob) {
        const url = URL.createObjectURL(blob);
        urls.push(url);
        const a = document.createElement('a');
        a.className = 'dl';
        a.href = url;
        a.download = name;
        a.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M8 12l4 4 4-4"/><path d="M5 20h14"/></svg>' +
            `<span>${name}</span><span class="sz">${fmtSize(blob.size)}</span>`;
        downloads.appendChild(a);
    }

    async function run() {
        if (!state.fontBytes) return;
        go.disabled = true;
        progress.style.display = 'block';
        progress.classList.remove('indeterminate');
        fill.style.width = '0%';
        plabel.textContent = 'Starting…';
        setStatus('', '');
        yielded = 0;

        try {
            const o = controls.readOptions();
            const fontName = o.fontName || state.fontName || 'font';

            const glyphSource = await createMsdfgenGlyphSource(state.fontBytes, {
                moduleOverrides: { locateFile: p => (p.endsWith('.wasm') ? wasmUrl : p) }
            });

            // kerning is opt-in: fontkit is heavy and Node-oriented, so load it lazily and degrade
            // gracefully if it can't run in this build.
            let kerningSource = null;
            if (o.kerning) {
                try {
                    // fontkit is Node-oriented — give it the globals it expects before loading it.
                    globalThis.global ??= globalThis;
                    if (!globalThis.process) globalThis.process = { env: {} };
                    if (!globalThis.Buffer) globalThis.Buffer = (await import('buffer')).Buffer;
                    const { fontkitKerningSource } = await import('@playcanvas/font-tools/kerning-fontkit');
                    kerningSource = fontkitKerningSource(state.fontBytes);
                } catch (err) {
                    console.warn('Kerning unavailable:', err);
                    setStatus('Kerning unavailable in this build — generating without it.', '');
                }
            }

            const { data, textures } = await generateFont({
                chars: o.chars,
                fontName,
                size: o.size,
                pxrange: o.pxrange,
                intensity: o.intensity,
                invert: o.invert,
                glyphSource,
                kerningSource,
                imageBackend: createCanvasImageBackend(),
                onProgress
            });
            glyphSource.dispose?.();

            revokeUrls();
            await renderAtlas(textures, data.info.maps);

            downloads.innerHTML = '';
            addDownload(`${fontName}.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
            textures.forEach((png, i) => addDownload(`${fontName}${i === 0 ? '' : i}.png`, new Blob([png], { type: 'image/png' })));
            downloads.style.display = 'flex';

            await preview.ensureApp();
            preview.setFont(await preview.buildFont(data, textures));
            preview.update();
            emptyState.style.display = 'none';

            setStatus(`Done — ${Object.keys(data.chars).length} glyphs, ${data.info.maps.length} page(s)${kerningSource ? ', kerning' : ''}.`, 'success');
        } catch (err) {
            console.error(err);
            setStatus(`Error: ${err.message}`, 'error');
        } finally {
            go.disabled = false;
            progress.style.display = 'none';
            progress.classList.remove('indeterminate');
        }
    }

    go.addEventListener('click', run);
}
