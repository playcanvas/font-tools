/**
 * A small draggable direction dial (vanilla, framework-less). The handle sits on a circular
 * track and points in the direction the shadow is cast: angle is degrees clockwise from east
 * (0 = right, 90 = down, 180 = left, 270 = up) — the convention atan2(dy, dx) yields directly
 * in screen space, so it maps straight onto the preview's shadow offset.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.el - The dial container (a square element).
 * @param {number} [opts.value] - Initial angle in degrees (default 45 → south-east).
 * @param {(angle: number) => void} opts.onInput - Called with the new angle on every change.
 * @returns {{ angle: number }} A handle whose `angle` getter/setter reads/writes the dial.
 */
export function createDial({ el, value = 45, onInput }) {
    let angle = value;
    const handle = document.createElement('div');
    handle.className = 'dial-handle';
    el.appendChild(handle);

    const render = () => {
        const c = (el.clientWidth || 34) / 2;   // dial is square; fall back if not laid out yet
        const r = c - 5;                          // keep the handle inside the track
        const rad = angle * Math.PI / 180;
        handle.style.left = `${c + r * Math.cos(rad)}px`;
        handle.style.top = `${c + r * Math.sin(rad)}px`;   // screen y-down → clockwise
        el.setAttribute('aria-valuenow', Math.round(angle));
        el.title = `Shadow direction: ${Math.round(angle)}°`;
    };

    const fromPointer = (ev) => {
        const r = el.getBoundingClientRect();
        const deg = Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
        angle = (deg + 360) % 360;
        render();
        onInput(angle);
    };

    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); fromPointer(e); });
    el.addEventListener('pointermove', (e) => { if (el.hasPointerCapture(e.pointerId)) fromPointer(e); });
    el.addEventListener('keydown', (e) => {       // accessibility: arrow keys nudge by 5°
        const step = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[e.key];
        if (step === undefined) return;
        e.preventDefault();
        angle = (angle + step + 360) % 360;
        render();
        onInput(angle);
    });

    render();
    return {
        get angle() { return angle; },
        set angle(v) { angle = (v + 360) % 360; render(); }
    };
}
