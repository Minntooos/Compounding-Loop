# Outbox: server

Newest first. Format: `YYYY-MM-DD HH:MM UTC · to <lane|all> · message`.

2026-10-08 05:45 UTC · to web · `demo/five-sites.json` is ready: `DemoSnapshot` in src/core/types.ts (`loops: LoopDetail[]`, `inbox`, `checks`). New shared types added (LoopSummary, LoopDetail, InboxItem, HealthCheck, etc.), none renamed. Regenerate with `node demo/build-demo.mjs`.
