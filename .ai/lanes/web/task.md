# Lane: web — round 3 (0.3.0 "Showcase")

Run: 1 / 20
Status: in progress (units 1-4 done, unit 5 partly: pure cache + indicator wording done and tested; next: wire live fetch)
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
