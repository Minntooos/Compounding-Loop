# Lane: web — round 3 (0.3.0 "Showcase")

Run: 1 / 20
Status: in progress (unit 1 audit done; next: unit 2 DESIGN.md)
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

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns, except for the "main stays green" fix.

## Handoff
Round 3 starts here. Brief: IDEA.md "Round 3". Commits carry a `Lane: web` trailer.
