// Copy the msdfgen .wasm into public/ so Vite ships it as a static asset served at the app's
// base URL. We reference it by URL (see main.js) instead of a `?url` import of the dependency's
// wasm subpath, which Rollup cannot resolve in production builds.
import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

mkdirSync(new URL('./public', import.meta.url), { recursive: true });
const src = fileURLToPath(import.meta.resolve('@playcanvas/msdfgen-wasm/msdfgen.wasm'));
const dest = fileURLToPath(new URL('./public/msdfgen.wasm', import.meta.url));
copyFileSync(src, dest);
console.log('copy-wasm: msdfgen.wasm -> public/');
