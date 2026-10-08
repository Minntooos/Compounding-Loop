import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Context } from 'hono';

export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // React sets inline style attributes; scripts stay locked to 'self'
  "img-src 'self' data:",
  "font-src 'self' data:", // Vite inlines tiny font subsets as data: URIs
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** Headers added to every response, API and files alike. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

export const mimeFor = (file: string): string => MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';

/**
 * Maps a URL path to a file inside `root`, or undefined when it would escape the folder.
 * Both separators are rejected so `..\` cannot sneak through on Windows.
 */
export function resolveInside(root: string, urlPath: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return undefined;
  }
  if (decoded.includes('\0') || decoded.split(/[\\/]/).includes('..')) return undefined;
  const file = path.resolve(root, `.${decoded.startsWith('/') ? decoded : `/${decoded}`}`);
  const rootResolved = path.resolve(root);
  return file === rootResolved || file.startsWith(rootResolved + path.sep) ? file : undefined;
}

async function isFile(file: string): Promise<boolean> {
  return (await stat(file).catch(() => undefined))?.isFile() ?? false;
}

/**
 * Serves the built dashboard. Unknown paths without a file extension fall back to index.html so
 * client-side routes work on reload; a missing asset (has an extension) is a real 404.
 */
export function staticHandler(root: string) {
  return async (c: Context): Promise<Response> => {
    const urlPath = new URL(c.req.url).pathname;
    const file = resolveInside(root, urlPath);
    if (file === undefined) return c.text('Not found', 404);
    let target = file;
    if (!(await isFile(target))) {
      if (path.extname(urlPath) !== '') return c.text('Not found', 404);
      target = path.join(root, 'index.html');
      if (!(await isFile(target))) return c.text('The dashboard is not built. Run `npm run build`.', 404);
    }
    const body = await readFile(target);
    // Hashed assets never change; index.html must always be re-fetched.
    const cache = target.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache';
    return new Response(new Uint8Array(body), { headers: { 'Content-Type': mimeFor(target), 'Cache-Control': cache } });
  };
}
