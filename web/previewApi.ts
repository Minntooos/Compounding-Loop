import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

// Stand-in for `loop dashboard --demo` while the server doesn't serve the built web app: answers the read routes of
// .ai/contracts.md from the demo snapshot so `vite preview` (used by e2e) sees real HTTP, not 404s.
export function previewApi(snapshotPath: string): Plugin {
  return {
    name: 'preview-api',
    configurePreviewServer(server) {
      const snap = JSON.parse(readFileSync(snapshotPath, 'utf8')) as { loops: { id: string }[]; inbox: unknown[]; checks: unknown[] };
      server.middlewares.use('/api', (req, res, next) => {
        const path = (req.url ?? '').split('?')[0] ?? '';
        const loopId = /^\/loops\/([^/]+)$/.exec(path)?.[1];
        const body = path === '/loops' ? snap.loops : path === '/inbox' ? snap.inbox : path === '/checks' ? snap.checks
          : path === '/health' ? { ok: true, version: 'preview', demo: true }
          : loopId ? snap.loops.find((l) => l.id === decodeURIComponent(loopId)) : undefined;
        if (body === undefined) return next();
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(body));
      });
    },
  };
}
