/**
 * Entry point — wires the small modules together and holds the shared font state.
 * All the work lives in ./src: dropzone (source input), controls (charset/size/advanced),
 * preview (live PlayCanvas render), and generate (the build pipeline).
 */

import { initDropzone } from './src/dropzone.js';
import { initControls } from './src/controls.js';
import { createPreview } from './src/preview.js';
import { initGenerate } from './src/generate.js';

const $ = id => document.getElementById(id);

const state = { fontBytes: null, fontName: 'font' };

const preview = createPreview({ canvas: $('preview'), wrap: $('preview-wrap') });
const controls = initControls();

initDropzone({
    onFont(bytes, name) {
        state.fontBytes = bytes;
        state.fontName = name;
        $('go').disabled = false;
        $('facename').placeholder = name;
        $('status').textContent = '';
        $('status').className = '';
    }
});

initGenerate({ state, controls, preview });

// live preview controls (text + appearance — appearance is preview-only, not baked into the font)
const readPreview = () => ({
    text: $('ptext').value,
    size: $('psize').value,
    color: $('pcolor').value,
    opacity: $('popacity').value,
    outlineColor: $('poutline-color').value,
    outlineThickness: $('poutline-thickness').value,
    shadowColor: $('pshadow-color').value,
    shadowOffset: $('pshadow-offset').value
});
['ptext', 'psize', 'pcolor', 'popacity', 'poutline-color', 'poutline-thickness', 'pshadow-color', 'pshadow-offset']
    .forEach(id => $(id).addEventListener('input', () => preview.update(readPreview())));

// live numeric readouts for the appearance sliders
const fmt = {
    popacity: v => `${Math.round(v * 100)}%`,
    'poutline-thickness': v => (+v).toFixed(2),
    'pshadow-offset': v => (+v).toFixed(2)
};
Object.keys(fmt).forEach((id) => {
    const out = $(`${id}-out`);
    const sync = () => { out.value = fmt[id]($(id).value); };
    $(id).addEventListener('input', sync);
    sync();
});

// background swatches
document.querySelectorAll('.bg-sw').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.bg-sw').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    preview.setBackground(btn.dataset.bg);
}));
