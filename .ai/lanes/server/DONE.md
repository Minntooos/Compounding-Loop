# Lane DONE: server, round 3 (0.3.0 "Showcase")

## Built
- Self-build snapshot covering rounds 1 and 2 (pin 084bb9f) in `demo/` (unit 2).
- `src/server/live/**`: pure, browser-safe mappers from GitHub commits, Actions runs and raw files to the dashboard types, plus `liveUrls`, `laneFilePaths`, `rawUrl`, `buildLiveLoop`; tested against scrubbed fixtures. Shape in `.ai/contracts.md` "Live mode" (unit 3).
- Static export writes `live.json` and a CSP meta tag (`connect-src` = api.github.com + raw.githubusercontent.com); the local server CSP is unchanged (unit 4).
- Claims flow through `LaneStatus.claim` (core) and the live mapper (unit 5).

## Test results
Run 2 on a fresh pull: `npm test` green (check, typecheck, unit, build, e2e: 120 passed, 26 skipped). Round 3 audit: no open blockers.

## Unsure
- The self snapshot has no test count (none was recorded at the pin).
- The live path was never run against the real GitHub API from the cloud (no network); fixtures are hand-written to the documented shapes.

## Next 10 improvements, by value to users
1. Check the live mappers against real GitHub responses once, and refresh the fixtures.
2. Handle GitHub API rate limits (60/h unauthenticated) with a clear message and ETag use in the web fetch.
3. Record test counts per round in the self snapshot.
4. Make `loop run` write `.ai/runs.jsonl` and `.ai/last-test.json` so two health checks work end to end.
5. Probe the live site URL for leaked `/.ai/task.md`, `/CLAUDE.md`, `/.git/config`.
6. Leak check for GitHub Pages, Vercel and Cloudflare Pages configs.
7. Surface `pushed:false` from the answer route as a visible warning.
8. Cache loop reads for ~2 s and skip polling when no SSE client is connected.
9. Per-loop cron period for the runner-silent check.
10. Emit `checks-changed` events when a check flips.
