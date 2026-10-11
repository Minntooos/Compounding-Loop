# Lane: web — round 3 (0.3.0 "Showcase")

Run: 7 / 20
Status: in progress (units 1-7 and 5 done; unit 8 partly; unit 9 last)
Round 2 record: `.ai/lanes/web/done-v2.md` (`git show 084bb9f:.ai/lanes/web/task.md` for its Decisions).

## Contract
**Goal:** the dashboard a senior product designer would ship, live from GitHub in the demo (IDEA.md Round 3 must-haves 1, 2, 4, 5 UI side). It is the launch.
**Done when:** every web line of "Round 3 done when" in IDEA.md passes: mocked-GitHub e2e (live, rate-limit fallback, copy command), axe at 1440 and 375 px in both themes, no console errors, no horizontal scroll at 375 px, bundle under 300 kB gzip, `web/DESIGN.md` plus before/after screenshots, and an independent design review recorded in `.ai/audit/web.md`.
**Constraints:** round 1 and 2 rules (no runtime CDN, no `innerHTML` with repo text, tokens from IDEA.md, no new UI library; a new dev dependency or a chart library needs a Decisions line and must be under 15 kB gzip).
**Out of scope:** mapping GitHub responses to API types (server's `src/server/live/**`), parsers (core).

## Units, in order
1. Round 3 re-audit (`.ai/audit/web.md`) with "before" screenshots of every screen, both themes, 1440 and 375 px.
2. Research and write `web/DESIGN.md` (IDEA.md must-have 1). Spend real effort here: at least six reference products, the pattern each contributes, and a concrete per-screen layout. The rest of the round is built against it.
3. Phone nav + the 404 + console errors (quick wins).
4. Welcome strip replacing the grey banner, with the live/snapshot indicator (fixture first).
5. Live mode: fetch the URLs server's live module lists, cache 5 min per tab (sessionStorage, wrapped in try/catch), refresh while visible, fall back to the snapshot on error/403; mocked-GitHub e2e. Until server's mappers land, build against a fixture.
6. Fleet cards with progress (round, run budget bar, state, last activity), self-build card first.
7. Loop detail: Timeline grouped by day, lane colours, lane filter, absolute UTC times; runs/tests chart; lane rows with claims.
8. Empty/loading/error/rate-limited states everywhere; reduced motion; both themes.
9. After screenshots to `docs/assets/screens/` (tell docs), independent design review against DESIGN.md (a reviewer subagent that did not write the UI), fix what fails, record the result.

## Decisions
- 2026-10-11: lane colours are Okabe-Ito tuned to AA on both themes (web/DESIGN.md §3); status palette from IDEA.md unchanged. Charts hand-written SVG, no dependency. Timeline times are absolute UTC (relative in title). DESIGN.md research: only Vercel Geist was re-verified online, others from working knowledge, stated in the doc.

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns, except for the "main stays green" fix.

## Handoff
Run 1 shipped units 1-4 (audit + before shots in web/design/before, web/DESIGN.md, phone nav + 404 fix, welcome strip + snapshot chip) and the pure half of unit 5 (`web/src/lib/liveCache.ts`, tested). Main is green (npm test: 106 e2e + unit).
Next: unit 5 remainder: server lane has NOT yet shipped `src/server/live/**` or core's browser parsers (check `git log` first). Asked server in its outbox for `health.json` `live.repo`, `generatedAt`, and `loadLive(fetch, repo)` (shape in my outbox). If they haven't landed, build against a fixture: add a hook `useLive()` in web/src/api/live.ts that reads `live` from the health probe (hasServer in client.ts currently discards the body), caches via liveCache.ts in sessionStorage, refreshes every 5 min while document.visibilityState is visible, and replaces the snapshot chip in App.tsx with `indicatorText`. Mocked-GitHub e2e via page.route (a/b/c from IDEA.md Round 3 done-when; (c) is already covered in tests/e2e/welcome.spec.ts). Then units 6-9 per the list; DESIGN.md §5 is the layout spec. Screenshots helper: `SCREENS=1 SCREENS_DIR=web/design/after npx playwright test screenshots --project=laptop`. Tip: `npm run build` before running single e2e specs (they serve dist/web).
Commits carry a `Lane: web` trailer.

## Handoff (run 2)
Unit 6 done: fleet cards with round + run-budget bars (web/src/lib/card.ts, ProgressBar.tsx), self-build card first and 2 columns wide, empty rows omitted, `--surface-2` token added. Server's `src/server/live/**` still absent at 05:50 UTC; unit 5 remainder still waits on it (or build against a fixture per the run-1 handoff). Next: unit 7 (Timeline by day, lane colours/filter, chart, claims in Lanes tab; `LaneStatus.claim` exists in types), then unit 8. Reviewer left minor gaps for the self card: story line, lane chips with mini bars, commit count in 'Last activity'.

## Handoff (run 2, later)
Unit 7 partly done: Timeline grouped by UTC day, lane colour + name, lane filter, absolute UTC times (web/src/lib/timeline.ts, components/Timeline.tsx, `--lane-*` tokens). Lane is inferred from the commit subject prefix (`web:`), as LoopCommit has no trailer; untagged commits are "other". Day headings are NOT sticky yet (DESIGN says sticky; do it once the shell header height is fixed). Still open in unit 7: runs/tests chart (hand-written SVG, text alternative), claims in the Lanes tab (`LaneStatus.claim`), self-card story line/lane chips. Then unit 8, then 5 remainder when server's live module lands.
- 2026-10-11 Decision: the chart shows commits per day (last 60 days), not runs/tests over time: the API has no run history per day. Shown only with 2+ days of data (the current demo snapshot is one day, so no e2e). Revisit when server's live data lands.
Run 2 end: unit 7 done except sticky day headings and self-card extras. Lanes tab now shows claim text and a run bar; commits-per-day chart added (ActivityChart.tsx). Next: unit 8 (states/reduced motion audit), then unit 5 remainder (check `git log` for src/server/live), then unit 9.
Unit 8 partly: Loading is now a skeleton (QueryState.tsx). Still open in 8: shared Notice component, rate-limited state (needs live mode), per-screen skeleton shapes. Unit 5 remainder blocked on server's `src/server/live/**` (absent at 06:00 UTC); unit 9 (after screenshots to docs/assets/screens/, independent design review into .ai/audit/web.md) must come last.

## Handoff (run 3)
Unit 5 done: live mode. `web/src/lib/liveFetch.ts` (tree listing so absent files are never requested, then server's `buildLiveLoop`), `web/src/api/live.ts` (5 min sessionStorage cache, store for the header chip), `liveMerge.ts`, `SourceChip` in App.tsx, 5-min refresh while visible; `tests/e2e/live.spec.ts` (live, rate-limited, unreachable, axe both themes) and `tests/unit/web/liveFetch.test.ts`. Fleet card titles are now h2 (axe heading-order). Local `main` had an unrelated history at run start; reset to origin/main, old one kept as branch `local-old-main`.
Known small gaps (reviewer): a cold load costs 3 anonymous API calls (tree, commits, runs) of 60/h; after a failed forced refresh the chip can bounce back to live from the cache. Next: unit 8 remainder (shared Notice, rate-limited state per screen, skeleton shapes), sticky day headings, self-card extras, then unit 9 (screenshots to docs/assets/screens/, independent design review into .ai/audit/web.md).

## Handoff (run 4)
Unit 8 mostly done: shared `Notice` (QueryState.tsx), `PausedLiveNotice` under the h1 when rate-limited (e2e in live.spec.ts), sticky day headings (shell header is not sticky, so top-0). Still open: per-screen skeleton shapes, self-card story line/lane chips, then unit 9 (screenshots to docs/assets/screens/, independent design review into .ai/audit/web.md, tell docs). Main is green (120 e2e + 443 unit).

## Handoff (run 5)
Owner review (control-room 07:55) done: laned building loops show "N of M lanes done" instead of the round bar, run bar hidden when done or run=0, live self card gets CI row + Live site (assumed GitHub Pages URL, unverified; `LoopSummary.ci`/`demoUrl` added to core types, additive). Remaining: per-screen skeleton shapes, self-card story line, then unit 9 (screenshots to docs/assets/screens/, independent design review into .ai/audit/web.md, tell docs).

## Handoff (run 6)
Unit 9 done: after screenshots (demo mode: strip + snapshot chip; new `self` screen from the live server) in web/design/after and docs/assets/screens; independent review recorded in .ai/audit/web.md; loop tabs are now one scrollable row. Capture fix: tests/e2e/screenshots.spec.ts routes /api/health to 404 so shots show demo mode. Remaining minors (see audit): loop header "Round 2/3 · Run 36/250" is mono text, no bar; per-screen skeleton shapes; self-card story line vs Done badge; fleet cards lack run bars. Main green (120 e2e + 452 unit). Lane DONE not yet written: fix the minors first, then DONE.md.

## Handoff (run 7)
Loop header now shows the run budget as a bar (hidden when done or run=0), asserted in live.spec.ts. Main green (120 e2e + 452 unit). Remaining minors: per-screen skeleton shapes, self-card story line vs Done badge. Then write DONE.md (docs already swapped in the screenshots).
