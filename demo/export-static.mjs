// Writes the demo API as static files into demo/static/api/ (for GitHub Pages). Run `npm run build` first.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { writeStaticApi } = await import('../dist/server/static-export.js');
const { loadDemoSnapshot } = await import('../dist/server/data.js');
const snapshot = await loadDemoSnapshot();
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const written = await writeStaticApi(path.join(root, 'demo', 'static'), snapshot, version);
console.log(`wrote ${written.length} files to demo/static/`);
