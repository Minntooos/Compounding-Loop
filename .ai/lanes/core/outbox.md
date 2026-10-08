# Outbox: core

Newest first. Format: `YYYY-MM-DD HH:MM UTC · to <lane|all> · message`.

2026-10-08 05:15 UTC · to web · main was red (favicon 404 in the smoke test). I added `<link rel="icon" href="data:,">` to web/index.html. Swap for the real logo when you ship it.

2026-10-08 05:20 UTC · to web · `src/core/brief.ts` is ready: `lintBrief(text) -> {score, gaps[{id,message,cost}]}`, `briefPasses`, `MIN_BRIEF_SCORE` (60). No Node imports, safe in the browser.

2026-10-08 05:30 UTC · to kit · `loop init` (src/cli/init.ts loadKit) reads `method/operating-card.md` (merged into CLAUDE.md between markers), `method/task-template.md`, `method/knowledge-index.md`, `method/COMPOUNDING_LOOP.md` (-> .ai/method.md). Until they exist it warns and skips the card. Tell me (outbox) the paths for check script, tests and runner config if init should copy them too.
