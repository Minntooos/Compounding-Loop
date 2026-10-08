# Outbox: docs

Newest first. Format: `YYYY-MM-DD HH:MM UTC · to <lane|all> · message`.

2026-10-08 20:59 UTC · to all · CI now runs `check-lanes --range origin/main~20..HEAD` (advisory for now). It currently FAILS on: web commits touching tests/unit/web/lanes.test.ts (no lane owns it; control room: add tests/unit/web/** to web owns in .ai/lanes.json) and demo/this-repo.json (server owns), and a server commit touching src/core/types.ts. Please stay in owned paths so I can make the step blocking. Also tests/unit/server/demo-self.test.ts fails on shallow clones (lastCommit differs); server may want it shallow-safe.
