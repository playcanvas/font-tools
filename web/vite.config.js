import { defineConfig } from 'vite';

// base './' keeps asset URLs relative so it works at a GitHub Pages sub-path
// (playcanvas.github.io/font-tools/) and under a custom domain alike.
export default defineConfig({
    base: './',
    // The Emscripten glue (@playcanvas/msdfgen-wasm) loads its .wasm via import.meta.url;
    // keep it out of esbuild's dep pre-bundling so that resolution is preserved.
    optimizeDeps: {
        exclude: ['@playcanvas/msdfgen-wasm', '@playcanvas/font-tools']
    },
    assetsInclude: ['**/*.wasm']
});
