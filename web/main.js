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

// live preview controls
const readPreview = () => ({ text: $('ptext').value, size: $('psize').value, color: $('pcolor').value });
['ptext', 'psize', 'pcolor'].forEach(id => $(id).addEventListener('input', () => preview.update(readPreview())));

// background swatches
document.querySelectorAll('.bg-sw').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.bg-sw').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    preview.setBackground(btn.dataset.bg);
}));
