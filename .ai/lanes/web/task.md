# Lane: web — round 5 (0.5.0 "Cockpit")

Run: 2 / 20
Status: units 1-3 done (audit, DESIGN.md §12, P0 fixes, C1 strip + C2 Needs-you rows), C7 Releases chips done; next: unit 4 (C4 steer composer + C5 schedule controls)
Round 4 record: `.ai/lanes/web/done-v4.md` (`git show 02874e8:.ai/lanes/web/task.md` for its Decisions).
How a run works: `.ai/lane-run.md` (cheap stop checks, steering, run log, idle backoff).

## Contract
**Goal:** the cockpit: in 5 seconds the owner knows what needs them and what is running, and can steer any lane or unit in one sentence (IDEA.md Round 5 A2-A4, A6, A8, C1-C8).
**Owns (globs from `.ai/lanes.json`):** web/**, tests/e2e/**, tests/unit/web/**
**Done when:**
- `npm test` passes.
- Round 5 audit section with no open blocker; A3, A4, A6 and A8 have regression tests.
- The e2e list in IDEA.md "Round 5 done when", with GitHub and npm mocked through Playwright routing, passes.
- axe: zero serious or critical violations on every screen, both themes, at 1440 and 375 px; no horizontal page scroll at 375 px; zero console errors.
- An independent design reviewer verdict for every unit is recorded in `.ai/audit/web.md`, and the final home screenshot answers the five 5-second questions with "yes".
- JS bundle under 300 kB gzip.
**Constraints:** edit only the paths you own, plus the smallest edit to shared files (CLAUDE.md "Lanes"). Read anything. Unacknowledged `next-run` entries in `steer.md` come before this list.
**Out of scope:** Data shaping and routes (server), parsers and commands (core). Ask in your outbox; use demo fixtures while you wait, never invent data shapes.

## Units, in order
1. Round 5 re-audit (`.ai/audit/web.md`), starting from your afa659e design review and the owner's P0 list (IDEA.md A).
2. DESIGN.md first: the status strip, needs-you row, heat-map cell + legend, steer composer, schedule controls, Releases list. Then A3, A4, A6, A8 (P0 polish) with tests.
3. C1 status strip + C2 Needs you (one shared attention list feeds the banner, the strip and the Inbox).
4. C4 steer composer (+ history with acknowledgements) and C5 schedule controls; demo opens prefilled GitHub URLs, local saves through the API.
5. C3 lane × hour heat map (from `classifyRunSlots`) and the Runs tab link.
6. C6 next round with ingredients, Draft with Claude (SSE) and Copy prompt; Go stays a separate click. C7 Releases.
7. After-screenshots for docs (optimised PNGs under 400 kB, replace the 5.4 MB phone shots), then audit majors.

## Decisions
- 2026-10-13 run 1: did the P0 fixes A1/A4/A8 before the DESIGN.md unit, because they add no new component (DESIGN.md is for new components). Easy to reverse.
- 2026-10-13 run 1: the Inbox page lists every attention item (server inbox items + computed lane/failing/release rows), so the nav badge, the fleet banner and the Inbox can never disagree (A4). This is the seed of C2's Needs-you rows.
- 2026-10-13 run 1: C7 tag/npm chips were done early (run 1) because server's data was already on main; the rest of unit 6 (C6) stays in order.
- 2026-10-13 run 1: release sentence is "Release is off · <label> · <detail>" (no colon of ours), because core's ship-check details can contain colons.

- 2026-10-13 run 2: strip state Paused ranks above Likely running (DESIGN §12 put Running/Likely first): the pause commit is itself recent activity and a paused loop runs nothing. Without server run outcomes, "Likely running" = a run line or commit within core's RUN_WINDOW_MS (50 min).
- 2026-10-13 run 2: the CI segment reads `ci` and falls back to `tests` (local loops have tests, not CI). The fleet shows no separate green "Nothing needs you" banner any more: the strip says it once.
- 2026-10-13 run 2: "Round done and released → Start next round" is NOT an attention item: A1 (owner's P0) says a shipped release leaves the attention list. The ControlBar keeps Start next round.

## Confirmed
- CONFIRMED: Playwright route handlers that `route.fetch()` can fail a test with "Response has been disposed" when the test ends mid-fetch; cockpit.spec.ts serves static fixtures instead (3/3 green after, 1/4 flaky before).
- CONFIRMED: the demo's self loop is a done laned loop with a waiting release, so the demo Inbox shows a release row since run 1 (tests/e2e/screens.spec.ts routes `/api/loops` to [] for the empty state).
- CONFIRMED: `tests/e2e/attention.spec.ts` fails on the pre-run-1 code (badge/banner disagree, shipped still waiting) and passes after.

## Guesses

## Tried
- run 1: nav fade e2e flaked under parallel load because the Inbox badge widens the nav after first paint; fixed with a ResizeObserver in useScrollFade and expect.poll in the test (CONFIRMED, 15/15 repeats green).

## Don't
- Edit paths another lane owns (a fix to a red `main` is the one exception; say so in your outbox).
- Change the Operating Card, the version, `.ai/lane-run.md` or `.ai/control-run.md`; publish, tag or dispatch `release.yml`.

## Handoff
Run 2 (2026-10-13 02:44-03:10 UTC) shipped unit 3: status strip (`web/src/lib/strip.ts` pure, `StatusStrip.tsx` inside the header, every page; scoped on a loop page) and Needs-you rows (`web/src/lib/needsYou.ts`, `NeedsYouList.tsx`, fleet top and Inbox), both from `attentionItems`; tests `tests/unit/web/{strip,needsYou}.test.ts`, `tests/e2e/cockpit.spec.ts`. C8 design review done for run 1 and run 2 UI (verdict in `.ai/audit/web.md`).
Waiting on server: classified runs in the summary (limit stops in 5 h, running/sleeping, next due lane) → pass `limitStops` into `stripSegments` and add Sleeping/Running; `POST …/schedule` → local Wake on stalled rows (now "Open loop"); new demo fixtures (self card still round-3 snapshot text).
Core HAS shipped (check before building): `formatSteerEntry`, `parseSteer`, `steerPath`, `parseSchedule`, `notDueReason`, `classifyRunSlots`, `buildDraftPrompt` in `src/core/parse/index.ts`.
Next: unit 4, C4 steer composer (preview with core's `formatSteerEntry`; demo → GitHub edit URL of `steer.md`; ask server for a "new steer entry" URL builder or build it from `editFileUrl` + copy) and C5 schedule controls (state sentence from `parseSchedule`/`notDueReason`; demo → Edit on GitHub `schedule.json`). DESIGN.md §12 already specs both. After each web unit: independent design reviewer on 1440/375 screenshots both themes (script pattern: start `node bin/loop.js dashboard --demo --no-open --port 4174`, Playwright with `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`).
