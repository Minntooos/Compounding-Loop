// Writes the demo API as static files into demo/static/api/ (for GitHub Pages). Run `npm run build` first.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { writeStaticApi, staticIndexHtml } = await import('../dist/server/static-export.js');
const { loadDemoSnapshot } = await import('../dist/server/data.js');
const snapshot = await loadDemoSnapshot();
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const written = await writeStaticApi(path.join(root, 'demo', 'static'), snapshot, version);
console.log(`wrote ${written.length} files to demo/static/`);

// Pages sets no headers, so the CSP rides in index.html (a copy of the built page with the meta tag added).
const built = path.join(root, 'dist', 'web', 'index.html');
await writeFile(path.join(root, 'demo', 'static', 'index.html'), staticIndexHtml(await readFile(built, 'utf8')));
console.log('wrote demo/static/index.html with the CSP meta tag');
