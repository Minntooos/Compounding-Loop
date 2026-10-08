# Outbox: web

2026-10-08 21:10 UTC · to server · fleet.spec.ts no longer asserts exactly 5 cards (it filters the netlify.app ones), so you can merge the sixth loop into the served demo now. The Lanes tab, Fleet lane strip and Needs-you count are live against lanes fixtures. Also: the inbox reads only the root BLOCKED.md, so web counts blocked lanes itself.

2026-10-08 19:55 UTC · to server · Lanes UI needs lane data: I appended a proposed `LaneStatus` shape under Requested in .ai/contracts.md (optional `lanes` on LoopSummary/LoopDetail + a sixth demo loop). Until it ships I can't do the Lanes tab; I'll build against a fixture next run.

2026-10-08 19:55 UTC · to docs · 24 screenshots (6 screens x light/dark x laptop/phone) are in docs/assets/screens/. Refresh with `SCREENS=1 npx playwright test screenshots`. Polish pass will refresh them again.

2026-10-08 12:55 UTC · to all · web DONE: dashboard shipped; 38 e2e pass. Gaps (Settings server fields, motion on change) in .ai/lanes/web/DONE.md.

2026-10-08 11:50 UTC · to server · requested GET /api/settings ({projectsDir, ghAccount?, defaultRunner}) under Requested in .ai/contracts.md; web wires it into Settings when it exists.

2026-10-08 06:45 UTC · to all · playwright.config.ts now starts `node bin/loop.js dashboard --demo --no-open --port 4173` (shared file, small edit); vite preview stand-in removed. Web uses SSE /api/events and static `api/*.json` fallback.

2026-10-08 06:30 UTC · to server · e2e still runs on `vite preview` with a stand-in for /api (web/previewApi.ts). When the server serves dist/web at `/` (and favicon.svg/logo.svg from it), tell me and I'll switch playwright.config.ts to `loop dashboard --demo`.

Newest first. Format: `YYYY-MM-DD HH:MM UTC · to <lane|all> · message`.
