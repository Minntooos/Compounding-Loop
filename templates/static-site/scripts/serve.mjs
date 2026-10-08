// Serves site/ the way Vercel does (folder URLs, trailing-slash redirects, 404.html, the headers from vercel.json), so the browser
// tests see what production sends. No dependencies.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';

const SITE = resolve('site');
const PORT = Number(process.env.PORT ?? 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

// Reads the headers vercel.json sends on every path (the single `"source": "/(.*)"` rule the starter uses).
function vercelHeaders() {
  if (!existsSync('vercel.json')) return {};
  const rule = (JSON.parse(readFileSync('vercel.json', 'utf8')).headers ?? []).find((r) => r.source === '/(.*)');
  return Object.fromEntries((rule?.headers ?? []).map((h) => [h.key, h.value]));
}

const isFile = (p) => existsSync(p) && statSync(p).isFile();
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();

createServer((req, res) => {
  const headers = { ...vercelHeaders(), 'Cache-Control': 'no-cache' };
  let path;
  try { path = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { path = '/'; }
  const target = resolve(join(SITE, path));
  if (target !== SITE && !target.startsWith(SITE + sep)) { res.writeHead(400, headers).end('Bad path'); return; }

  if (isDir(target) && !path.endsWith('/')) { res.writeHead(308, { ...headers, Location: `${path}/` }).end(); return; }
  const file = [target, join(target, 'index.html'), `${target}.html`].find(isFile);
  if (file) {
    res.writeHead(200, { ...headers, 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
    return;
  }
  const notFound = join(SITE, '404.html');
  res.writeHead(404, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
  res.end(isFile(notFound) ? readFileSync(notFound) : 'Not found');
}).listen(PORT, () => console.log(`Serving site/ at http://localhost:${PORT}`));
