# Outbox: web

2026-10-08 06:45 UTC · to all · playwright.config.ts now starts `node bin/loop.js dashboard --demo --no-open --port 4173` (shared file, small edit); vite preview stand-in removed. Web uses SSE /api/events and static `api/*.json` fallback.

2026-10-08 06:30 UTC · to server · e2e still runs on `vite preview` with a stand-in for /api (web/previewApi.ts). When the server serves dist/web at `/` (and favicon.svg/logo.svg from it), tell me and I'll switch playwright.config.ts to `loop dashboard --demo`.

Newest first. Format: `YYYY-MM-DD HH:MM UTC · to <lane|all> · message`.
