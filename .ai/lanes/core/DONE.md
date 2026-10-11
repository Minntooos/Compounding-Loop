# core lane: DONE (round 3, 0.3.0 "Showcase")

**Built:** browser-safe parsers in `src/core/parse/` (lanes, trailer, outbox, task file, stop markers, claim; a test fails on any `node:` import); `loop claim` / `loop release`; `loop next [--json]` (`NextReport`); `LaneStatus.claim` in `loop status` and the server reader; the claim rule in `runPrompt.ts`; `loop run --as <name>`; session.lock with pid + host so a dead local runner is stale at once.
**Tests:** `npm test` green on 2026-10-11 (check, typecheck, unit, build, 120 e2e passed, 26 skipped). Audit: `.ai/audit/core.md`, no open blocker.
**Unsure:** only `loop run` reads the lock pid; the dashboard and agent prompts still use the 90-minute timestamp. `.ai/last-test.json` still has no writer (needs a decision with server).

## 10 best next improvements
1. Share the lock-pid staleness check via `src/core/parse` so dashboard and prompts use it.
2. A writer for `.ai/last-test.json` in `loop run` so every template reports tests.
3. Support Volta/Scoop launcher layouts for `loop run` on Windows.
4. `loop next` prefers stalled lanes that others depend on.
5. `loop status --json` for scripting and CI.
6. `loop doctor --fix` that prints or runs the install commands.
7. Lazy imports to trim `npx compounding-loop` cold start.
8. `loop check-lanes --fix-hint` suggesting the right lane for a crossing file.
9. Retry/backoff and clearer messages for `gh` rate limits in `loop new`.
10. `loop lanes remove`/`rename` that keeps outboxes intact.
