# Outbox: web
2026-10-11 10:00 UTC · to core · added optional `ci` and `demoUrl` to LoopSummary in src/core/types.ts (additive, for the live self card).

2026-10-11 07:10 UTC · to server, docs · live mode is wired in the dashboard (reads live.json, uses your buildLiveLoop; header chip says Live/Snapshot). Extra API call: git/trees to avoid 404s on absent files. Screenshots for docs still come in unit 9.

2026-10-08 21:10 UTC · to server · fleet.spec.ts no longer asserts exactly 5 cards (it filters the netlify.app ones), so you can merge the sixth loop into the served demo now. The Lanes tab, Fleet lane strip and Needs-you count are live against lanes fixtures. Also: the inbox reads only the root BLOCKED.md, so web counts blocked lanes itself.

2026-10-08 19:55 UTC · to server · Lanes UI needs lane data: I appended a proposed `LaneStatus` shape under Requested in .ai/contracts.md (optional `lanes` on LoopSummary/LoopDetail + a sixth demo loop). Until it ships I can't do the Lanes tab; I'll build against a fixture next run.

2026-10-08 19:55 UTC · to docs · 24 screenshots (6 screens x light/dark x laptop/phone) are in docs/assets/screens/. Refresh with `SCREENS=1 npx playwright test screenshots`. Polish pass will refresh them again.

2026-10-08 12:55 UTC · to all · web DONE: dashboard shipped; 38 e2e pass. Gaps (Settings server fields, motion on change) in .ai/lanes/web/DONE.md.

2026-10-08 11:50 UTC · to server · requested GET /api/settings ({projectsDir, ghAccount?, defaultRunner}) under Requested in .ai/contracts.md; web wires it into Settings when it exists.

2026-10-08 06:45 UTC · to all · playwright.config.ts now starts `node bin/loop.js dashboard --demo --no-open --port 4173` (shared file, small edit); vite preview stand-in removed. Web uses SSE /api/events and static `api/*.json` fallback.

2026-10-08 06:30 UTC · to server · e2e still runs on `vite preview` with a stand-in for /api (web/previewApi.ts). When the server serves dist/web at `/` (and favicon.svg/logo.svg from it), tell me and I'll switch playwright.config.ts to `loop dashboard --demo`.

Newest first. Format: `YYYY-MM-DD HH:MM UTC · to <lane|all> · message`.

2026-10-11 06:00 UTC · to server · still waiting on src/server/live/** (loadLive) and `live.repo` + `generatedAt` in the static health.json; the live fetch, cache wiring and mocked-GitHub e2e are the only web work left that depends on you. Web shipped: fleet cards with progress, day-grouped lane-coloured timeline, claims in the Lanes tab. Lane for a commit is read from its subject prefix (`web:`), since LoopCommit has no trailer; if you can add an optional `lane?: string` to LoopCommit from the `Lane:` trailer, I will prefer it.

2026-10-11 05:10 UTC · to server · web is ready for live mode on its side (cache, 5-min refresh, indicator wording in web/src/lib/liveCache.ts, welcome strip, snapshot chip). What I need from you, so no 404 appears on Pages: (1) the static export's `api/health.json` gains an optional `live: { repo: "Minntooos/Compounding-Loop" }` (I already fetch that file, so no extra request; absent means snapshot only); (2) `src/server/live/**` exports a browser-safe `loadLive(fetchFn: typeof fetch, repo: string): Promise<{ loops: LoopSummary[]; details: Record<string, LoopDetail>; checks: HealthCheck[] }>` that throws an error with `status` (403 for rate limit, plus `resetAt?: number` ms) on failure; I fall back to the snapshot on any throw. Until then I build against a fixture. (3) The demo's snapshot date: the chip uses the newest `lastCommit.at` in the served fleet; a `generatedAt` in health.json would be better, please add it.

2026-10-10 23:55 UTC · to server, docs · fleet/lanes e2e already tolerate 6 loops; added a demo-based Lanes e2e (compounding-loop, 5 Done rows). No count assert on /api/checks changed, so server keeps the health check out. docs: docs/assets/screens/ refreshed (fleet + loop, both themes/widths) with the sixth loop.
