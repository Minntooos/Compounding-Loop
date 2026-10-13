# Lane: web — round 5 (0.5.0 "Cockpit")

Run: 3 / 20
Status: units 1-3 done; unit 4 C4 steer composer done (run 3), C4 history + C5 wait on server data/routes; C7 chips done; next: C5/C4-history once server ships, else unit 7 screenshots
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
8. C9 Pace control (DESIGN.md entry first, then the design review), from server's pace data.

## Decisions
- 2026-10-13 run 1: did the P0 fixes A1/A4/A8 before the DESIGN.md unit, because they add no new component (DESIGN.md is for new components). Easy to reverse.
- 2026-10-13 run 1: the Inbox page lists every attention item (server inbox items + computed lane/failing/release rows), so the nav badge, the fleet banner and the Inbox can never disagree (A4). This is the seed of C2's Needs-you rows.
- 2026-10-13 run 1: C7 tag/npm chips were done early (run 1) because server's data was already on main; the rest of unit 6 (C6) stays in order.
- 2026-10-13 run 1: release sentence is "Release is off · <label> · <detail>" (no colon of ours), because core's ship-check details can contain colons.

- 2026-10-13 run 2: strip state Paused ranks above Likely running (DESIGN §12 put Running/Likely first): the pause commit is itself recent activity and a paused loop runs nothing. Without server run outcomes, "Likely running" = a run line or commit within core's RUN_WINDOW_MS (50 min).
- 2026-10-13 run 2: the CI segment reads `ci` and falls back to `tests` (local loops have tests, not CI). The fleet shows no separate green "Nothing needs you" banner any more: the strip says it once.
- 2026-10-13 run 2: "Round done and released → Start next round" is NOT an attention item: A1 (owner's P0) says a shipped release leaves the attention list. The ControlBar keeps Start next round.
- 2026-10-13 run 3: C4 ships before the server's `POST …/steer`: locally the composer shows and copies the exact `npx compounding-loop steer [--standing] [--author x] -- <lane> '<text>'` command (POSIX single quotes; `--` so text starting with "-" stays text; verified against a scratch repo). Switch to Save / Save and wake when server ships the route. Easy to reverse.
- 2026-10-13 run 3: demo *Edit on GitHub* opens `/edit/main/.ai/lanes/<lane>/steer.md` first (inside the click, popup blockers) and then copies the entry: GitHub cannot prefill an edit. A "Create it with this entry" link (new-file URL, prefilled) covers repos with no steer.md yet.
- 2026-10-13 run 3: the unit scope is a free "Unit (optional)" field written as "Unit N: …" (DESIGN §12), because no lane unit list reaches the browser (`NextLane.openUnits` is CLI-only).

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
Run 3 (2026-10-13 05:44-06:15 UTC) shipped C4 steer composer: `web/src/lib/steer.ts` (pure: `steerDraft` via core's `formatSteerEntry`, `steerCommand`, `steerEditUrl`, `steerNewFileUrl`), `web/src/lib/steerEvents.ts` (`openSteer`, `onSteer`: S key + palette + lane-row buttons), `SteerDialog.tsx` (opened from ControlBar). Tests `tests/unit/web/steer.test.ts`, `tests/e2e/steer.spec.ts`. Design review run 3 recorded in `.ai/audit/web.md` and fixed (global `dialog:modal` centring in index.css, ship-wheel icon, sticky actions); phone loop-page strip now 2 lines.
Waiting on server (outbox 06:00): `POST …/steer` (then swap Copy command for Save / Save and wake), steer entries + schedule per lane on LoopDetail (Steer history, C5 state sentence + Pause lane/Snooze/Wake), `POST …/schedule`, run outcomes on LoopSummary (strip limit stops/Running/Sleeping, C3 heat map), demo fixtures, `POST …/draft-brief` + ingredients (C6).
Next: check server's outbox first; if the steer/schedule data is in, build Steer history (ack chips per DESIGN §12) and C5 controls (demo: Edit on GitHub on `.ai/schedule.json`). Otherwise unit 7 (optimised after-screenshots, replace 5.4 MB phone shots) — needs docs/assets which docs owns: produce them under tests/e2e output and hand to docs via outbox. After each web unit: independent design reviewer (script pattern in scratch: `node bin/loop.js dashboard --demo --no-open --port 4174`, Playwright `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`; demo snapshot has no laned loop, use local mode for loop pages). Don't `pkill -f` a pattern that appears in your own command line (it kills the shell).
