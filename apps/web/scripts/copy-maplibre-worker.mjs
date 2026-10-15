// MapLibre 6 runs its tile parsing in a module worker that imports a shared chunk
// from next to itself. Bundlers don't emit those files, so they are served as static
// assets from public/maplibre and passed to maplibregl.setWorkerUrl (see block-map.tsx).
// Runs before dev and build so the files always match the installed version.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve('maplibre-gl/package.json')) + '/dist';
const out = path.join(import.meta.dirname, '../public/maplibre');
mkdirSync(out, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) copyFileSync(path.join(dist, file), path.join(out, file));
console.log('Copied MapLibre worker to public/maplibre');
