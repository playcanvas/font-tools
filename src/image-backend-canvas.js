/**
 * Browser image backend: composites RGBA glyph cells onto a canvas and encodes a PNG via
 * the Canvas API. Mirrors the Node backend; one atlas page -> one PNG (Uint8Array). Uses
 * OffscreenCanvas when available, falling back to a DOM canvas.
 */

/**
 * Create a browser {@link ImageBackend}.
 *
 * @returns {{ composite(page: object): Promise<Uint8Array> }}
 */
export function createCanvasImageBackend() {
    return {
        async composite({ width, height, glyphs }) {
            const canvas = (typeof OffscreenCanvas !== 'undefined')
                ? new OffscreenCanvas(width, height)
                : Object.assign(document.createElement('canvas'), { width, height });
            const ctx = canvas.getContext('2d');

            // opaque black background (matches the Node backend; the MSDF shader reads .rgb)
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);

            for (const { x, y, bitmap } of glyphs) {
                const data = bitmap.data instanceof Uint8ClampedArray
                    ? bitmap.data
                    : new Uint8ClampedArray(bitmap.data);
                ctx.putImageData(new ImageData(data, bitmap.width, bitmap.height), x, y);
            }

            const blob = canvas.convertToBlob
                ? await canvas.convertToBlob({ type: 'image/png' })
                : await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            return new Uint8Array(await blob.arrayBuffer());
        }
    };
}
