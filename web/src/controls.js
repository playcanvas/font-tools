/**
 * Generation controls: charset presets (labelled with live glyph counts) plus a "Custom…" entry
 * that accepts literal characters, the glyph-size slider readout, and the advanced options
 * (distance range, intensity, invert, kerning, face name). `readOptions()` returns the inputs
 * ready to hand to generateFont.
 */

import { CHARSETS, resolveCharset } from '@playcanvas/font-tools';

const LABELS = {
    ascii: 'ASCII',
    latin: 'Latin',
    'latin-ext': 'Latin Extended',
    cyrillic: 'Cyrillic',
    greek: 'Greek'
};
const CUSTOM = '__custom__';

export function initControls() {
    const charset = document.getElementById('charset');
    const customWrap = document.getElementById('charset-custom-wrap');
    const custom = document.getElementById('charset-custom');
    const count = document.getElementById('charset-count');
    const size = document.getElementById('size');
    const sizeOut = document.getElementById('size-out');

    for (const name of Object.keys(CHARSETS)) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = `${LABELS[name] || name} (${resolveCharset(name).length})`;
        charset.appendChild(opt);
    }
    const customOpt = document.createElement('option');
    customOpt.value = CUSTOM;
    customOpt.textContent = 'Custom…';
    charset.appendChild(customOpt);
    charset.value = 'latin';

    const currentChars = () => (charset.value === CUSTOM ? custom.value : charset.value);

    function updateCount() {
        const isCustom = charset.value === CUSTOM;
        customWrap.style.display = isCustom ? 'block' : 'none';
        const n = resolveCharset(currentChars() || '').length;
        count.textContent = n ? `${n} glyph${n === 1 ? '' : 's'}` : 'Type characters to include.';
    }
    charset.addEventListener('change', updateCount);
    custom.addEventListener('input', updateCount);
    updateCount();

    sizeOut.textContent = `${size.value} px`;
    size.addEventListener('input', () => { sizeOut.textContent = `${size.value} px`; });

    return {
        readOptions() {
            return {
                chars: currentChars(),
                size: parseInt(size.value, 10) || 64,
                pxrange: parseFloat(document.getElementById('pxrange').value) || 8,
                intensity: parseFloat(document.getElementById('intensity').value) || 0,
                invert: document.getElementById('invert').checked,
                kerning: document.getElementById('kerning').checked,
                fontName: (document.getElementById('facename').value || '').trim()
            };
        }
    };
}
