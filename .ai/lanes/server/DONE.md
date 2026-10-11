# Server lane DONE (round 2)

## Built
- Lanes in the API (`lanes` on /api/loops and /api/loops/:id, using core's `deriveLaneState`), contracts updated, web told.
- Lane health: `lane-stalled` and `lane-waiting-on-finished` checks; a failing one makes the loop `failing`.
- Sixth demo loop "compounding-loop (this repo)" (`demo/this-repo.json`, generator `demo/build-self.mjs`) with a scrub test (no emails, paths, tokens, routine IDs); five-site numbers unchanged.
- Leak check covers Netlify, GitHub Pages, Vercel and Cloudflare Pages configs; `.ai/runs.jsonl` and `.ai/last-test.json` are read.
- Audit: `.ai/audit/server.md`, no open blocker.

## Tests
`npm test` green on a fresh pull at the start of run 3 (check, typecheck, unit, build, 76 e2e passed, 26 skipped screenshot tests).

## Unsure
- The sixth loop's health check is not served: tests/e2e/screens.spec.ts asserts exactly 10 checks (web's file). Not required by the contract.
- Stall threshold ignores each lane's cron (core's STALL_MINUTES); reported to core.
- `demo-self` rebuild test skips on shallow clones.

## Next 10 improvements (by user value)
1. Serve the sixth demo loop's health check once web's e2e allows 11.
2. Per-lane stall threshold from the lane cron (needs core).
3. Cache per-loop reads (git log) to scale past ~50 loops.
4. Assert 6 loops from `dist` after build in a test.
5. SSE event for lane state changes (today clients refetch).
6. Serve `last-test.json` details (failing test names) in loop detail.
7. Pagination for /api/loops with many loops.
8. Make demo-self rebuild test work on shallow clones.
9. Expose run history (`runs.jsonl`) as a time series endpoint.
10. `/api/health` summary endpoint for status badges.
