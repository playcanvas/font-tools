import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// base './' keeps asset URLs relative so it works at a GitHub Pages sub-path
// (playcanvas.github.io/font-tools/) and under a custom domain alike.
export default defineConfig({
    base: './',
    // Polyfill Node built-in MODULES for the lazily-loaded fontkit kerning source, but do NOT
    // auto-inject Buffer/process/global across every module — that triggers a circular-init (TDZ)
    // error in Vite's dev dependency pre-bundle. generate.js installs the few globals fontkit
    // expects just before it dynamically imports the kerning source instead.
    plugins: [
        nodePolyfills({ globals: { Buffer: false, global: false, process: false } })
    ],
    // The Emscripten glue (@playcanvas/msdfgen-wasm) loads its .wasm via import.meta.url;
    // keep it out of esbuild's dep pre-bundling so that resolution is preserved.
    // fontkit is reached only through the (excluded) font-tools package's lazily-imported kerning
    // source, so pre-bundle it up front — otherwise dev discovers it mid-generate and full-reloads.
    optimizeDeps: {
        include: ['fontkit'],
        exclude: ['@playcanvas/msdfgen-wasm', '@playcanvas/font-tools']
    },
    assetsInclude: ['**/*.wasm']
});
