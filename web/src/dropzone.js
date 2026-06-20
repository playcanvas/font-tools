/**
 * Source-font input: a real drag-and-drop target (the header/README have always promised "drop
 * in a TTF/OTF") plus click-to-browse and a one-click sample font. On load it shows a file chip
 * with size and a live specimen rendered in the actual font via the FontFace API, then hands the
 * bytes + base name to `onFont`.
 */

export function initDropzone({ onFont }) {
    const dz = document.getElementById('dropzone');
    const fileInput = document.getElementById('file');
    const info = document.getElementById('file-info');
    const nameEl = document.getElementById('file-name');
    const sizeEl = document.getElementById('file-size');
    const specimen = document.getElementById('specimen');
    const sample = document.getElementById('sample');

    let specimenFace = null;

    async function load(name, bytes) {
        const fontName = name.replace(/\.[^.]+$/, '') || 'font';
        nameEl.textContent = name;
        sizeEl.textContent = `${(bytes.length / 1024) | 0} KB`;
        info.style.display = 'flex';

        // live specimen in the actual font
        try {
            if (specimenFace) document.fonts.delete(specimenFace);
            specimenFace = new FontFace('ft-specimen', bytes);
            await specimenFace.load();
            document.fonts.add(specimenFace);
            specimen.style.fontFamily = 'ft-specimen, system-ui, sans-serif';
        } catch {
            specimen.style.fontFamily = '';
        }

        onFont(bytes, fontName);
    }

    async function fromFile(file) {
        if (!file) return;
        const bytes = new Uint8Array(await file.arrayBuffer());
        await load(file.name, bytes);
    }

    fileInput.addEventListener('change', e => fromFile(e.target.files[0]));

    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, (e) => {
        e.preventDefault();
        dz.classList.add('dragover');
    }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, (e) => {
        e.preventDefault();
        dz.classList.remove('dragover');
    }));
    dz.addEventListener('drop', (e) => {
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) fromFile(f);
    });

    async function loadSample() {
        try {
            const res = await fetch(`${import.meta.env.BASE_URL}test-font.ttf`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await load('test-font.ttf', new Uint8Array(await res.arrayBuffer()));
        } catch (err) {
            console.error('Sample font failed to load:', err);
            document.getElementById('status').textContent = 'Could not load the sample font.';
        }
    }
    sample.addEventListener('click', loadSample);
    sample.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            loadSample();
        }
    });
}
