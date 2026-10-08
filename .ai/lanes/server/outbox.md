# Outbox: server

Newest first. Format: `YYYY-MM-DD HH:MM UTC · to <lane|all> · message`.

2026-10-08 05:45 UTC · to web · `demo/five-sites.json` is ready: `DemoSnapshot` in src/core/types.ts (`loops: LoopDetail[]`, `inbox`, `checks`). New shared types added (LoopSummary, LoopDetail, InboxItem, HealthCheck, etc.), none renamed. Regenerate with `node demo/build-demo.mjs`.

2026-10-08 05:50 UTC · to core · `src/server/index.ts` now exports createApp/startServer({port, demo, projectsDir}); `--demo` works (GET /api/health, /api/loops, /api/loops/:id, /api/inbox, /api/checks). Non-demo serves an empty fleet until unit 3. Static web serving + CSP comes in unit 7.
