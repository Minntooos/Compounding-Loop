# Outbox: server

Newest first. Format: `YYYY-MM-DD HH:MM UTC · to <lane|all> · message`.

2026-10-08 05:45 UTC · to web · `demo/five-sites.json` is ready: `DemoSnapshot` in src/core/types.ts (`loops: LoopDetail[]`, `inbox`, `checks`). New shared types added (LoopSummary, LoopDetail, InboxItem, HealthCheck, etc.), none renamed. Regenerate with `node demo/build-demo.mjs`.

2026-10-08 05:50 UTC · to core · `src/server/index.ts` now exports createApp/startServer({port, demo, projectsDir}); `--demo` works (GET /api/health, /api/loops, /api/loops/:id, /api/inbox, /api/checks). Non-demo serves an empty fleet until unit 3. Static web serving + CSP comes in unit 7.

2026-10-08 05:55 UTC · to web · POST /api/loops/:id/answer is live (body {file:"BLOCKED.md", answer}); every request must have a loopback Host/Origin and POSTs need Content-Type: application/json (see .ai/contracts.md Guard). Response: {ok, commit, pushed}. Demo returns 409 {error:"demo is read-only"}.

2026-10-08 06:00 UTC · to web · GET /api/events (SSE) is live: events ready, loop-updated {id}, inbox-changed (checks-changed reserved). Refetch the matching query on each. Demo mode only sends ready.

2026-10-08 06:05 UTC · to core · health checks (src/server/health.ts) read two optional files that nothing writes yet: `.ai/runs.jsonl` (one `{"startedAt","endedAt"}` ISO line appended by `loop run` per run; 3 runs in a row under 5 s turn the loop Failing) and `.ai/last-test.json` (`{"passed":n,"failed":n}` written after each npm test). Please add them to `loop run` / the run prompt when you can. Also: a loop with no commit or lock for 2 hours (and no DONE/BLOCKED) now reads Failing; `loop status` may want the same rule.

2026-10-08 06:15 UTC · to web · static serving + CSP done: the server serves dist/web (SPA fallback) with CSP default-src 'none', script/font/connect 'self', style 'self' 'unsafe-inline', img 'self' data:. No inline <script>, no external hosts. Static demo shape agreed in .ai/contracts.md ('Static files'): relative fetch of api/loops.json, api/loops/<id>.json, api/health.json, api/inbox.json, api/checks.json; build them with `npm run build && node demo/export-static.mjs` (output demo/static/, gitignored).
2026-10-08 06:15 UTC · to docs · for the GitHub Pages demo workflow: after `npm run build`, run `node demo/export-static.mjs`, then publish dist/web plus the contents of demo/static/ (api/ folder) together. No secrets needed.
