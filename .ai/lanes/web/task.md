# Lane: web — round 5 (0.5.0 "Cockpit")

Run: 14 / 20
Status: units 1-8 done; run 14 re-shot final self shots (server's DONE core/kit snapshot), cleared four minors; next: remaining minors (list in Handoff)
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
- 2026-10-13 run 4: the docs screenshot set lives in `web/design/docs/` (docs owns `docs/assets/screens/` and copies it); shots are cut to the top of the page (laptop 1500 px, phone 1218 px @2x) because a 6000 px page is unreadable in a README and far over 400 kB.
- 2026-10-13 run 4: lane schedule sentence is shorter than DESIGN §12's example ("Sleeping · 3 idle runs · reason", "Paused · reason"): `ScheduleEntry` has no since/by fields. Done/blocked lanes say they stopped themselves instead of "Due". Snapshot loops read their schedule at their newest moment (`scheduleClock`), so the frozen demo never drifts.
- 2026-10-13 run 5: "Routines look off" replaces the server inbox's `lanes-not-running` item for that loop (`liveInbox`, also on the Inbox page) and its stalled-lane rows: that item blames the usage limit, which resets within 5 h, so after 6 h of silence its advice is wrong (reviewer blocker). Asked server to skip it at the source.
- 2026-10-13 run 5: local steer composer is one *Save* button, not Save + Save and wake: server's `POST …/steer` (core `runSteer`) always wakes a held-back lane. The CLI command stays folded under "Or run it from a terminal".
- 2026-10-13 run 5: C5 buttons ship without a toast Undo (Toasts has no actions; the opposite button undoes) and the demo shows one *Edit schedule on GitHub* link, not a prefilled schedule.json: core's schedule transform is node-only (src/cli/schedule.ts) and web must not re-implement it.
- 2026-10-13 run 6: the routines-off Needs-you row keeps "Open loop", not a Wake POST (`lane: "all"`): routines look off means due slots had no run at all, so the schedule is not what holds the lanes; waking would change nothing and read as a fix. Easy to reverse.
- 2026-10-13 run 6: a held-back building/waiting lane's badge shows the hold (Paused/Sleeping/Snoozed, muted) and a routines-off or stalled-lane building/waiting loop reads Stalled on its card and header (`laneHold`, `cardBadge`, `stateReason`, `chipHold`). Failing/blocked/done keep their badge.
- 2026-10-13 run 4: C5 buttons wait for server's `POST …/schedule`; this unit ships the state sentence and the steer history only.

- 2026-10-13 run 7: C6 ingredients come from `LoopDetail.draftInputs` (added to types.ts, core's `DraftInputs`); until server fills it, the dialog falls back to open findings + unread steer and says the DONE lists are missing, and the demo copies `npx compounding-loop next-round --draft --print-prompt` instead of a partial prompt (a partial one tells Claude there are no DONE lists). Easy to reverse.
- 2026-10-13 run 7: the draft replaces the box text; "Put back my text" restores what the owner typed (kept across several drafts). The server sends the draft whole at the end (no token stream), so "streams" = progress steps in the status line.

- 2026-10-13 run 8: heat-map hover/focus text is a readout line under the grid ("Newest: …" when nothing is hovered), not a floating tooltip: the grid scrolls sideways at 375 px and overflow clips a tooltip. Same words as the cell's aria-label.
- 2026-10-13 run 8: core's `missed` kind shows as *limit stop* (label adds "usage limit or a failed start"); core does not split limit stops from failed starts. `tests-failed` is *failed*. Without `kind`, outcome maps pushed→worked, nothing-pushed→idle, no-run-recorded→limit stop.
- 2026-10-13 run 8: the heat map shows on the Timeline (overview) tab head and the Runs tab head; cell links are `#/loop/<id>?tab=Runs&run=<at>&lane=<lane>` (parseRoute reads `focus`), and the picked row is outlined and scrolled into view; a quiet slot (no row) gets one "no run was expected" line.

- 2026-10-13 run 9: A3 before C9: server's 11:45 message waited on web (lane-run step 4.2). Health summary line counts states ("1 failing · 4 passing · 2 not checked"); an unchecked row names what it would measure and its badge says Not checked once.
- 2026-10-13 run 9: C9 chooser is inline (four radios), not a dialog. No "remove lane override": core's `withPace` has none; choosing the loop's pace for a lane is labelled "the loop’s pace". Auto-downshift notice waits for data (asked core/server for a pace note). Demo shows the whole new policy.json before copying it, so a blocked clipboard can select it.
- 2026-10-13 run 10: pushed the cockpit screenshots although the self shots show server's round 3 self snapshot (reviewer: "Done" header vs today's heat map, "Release waiting" vs "Release is off"): the spec and new shots are right, the data is server's; asked server to rebuild demo/this-repo.json and told docs not to copy `self-*` until re-shot. Easy to reverse (re-run the spec).

- 2026-10-13 run 12: write controls use `canWrite()` (server answers and /api/health `demo !== true`); App's snapshot chip, WelcomeStrip and Settings keep `hasServer`. e2e "local" tests call `writableServer(page)` (tests/e2e/writable.ts) because the Playwright webServer is `--demo`.
- 2026-10-13 run 12: a paused building/waiting loop's badge is Paused (below Stalled, like the strip), and while a loop is paused its lanes' `stalled` is ignored (badge, strip, attention list): core stalls lanes after 2 h even when paused. Easy to reverse if core fixes it at the source.

- 2026-10-13 run 13: the fleet filter keys on `cardBadge` (Stalled, Paused included), not raw `state`, so a filter's count matches the cards it shows; a filter that a live update empties falls back to All.
- 2026-10-13 run 13: beside a Paused badge the loop header shows no reason (the paused notice right below says who, when and why; A8 said once), except a lock reason (a session still running); `headerRound` reads the reason actually shown.
- 2026-10-13 run 13: phone strip keeps leaving out round and next-due (reviewer minor, C1): line 2 must stay one line in 343 px and the loop header/cards carry the round. Revisit only with a DESIGN.md pass. Easy to reverse (`short: ''` in web/src/lib/strip.ts).
- 2026-10-13 run 13: after "committed but not pushed" the pause/resume/next-round dialogs offer Close only (focus moves there): a Retry would commit the change twice. The network-error `catch` branch still offers Retry (we cannot know whether the server committed).

- 2026-10-13 run 14: every local write's not-pushed sentence comes from `notPushedText` (web/src/lib/controls.ts) and names the folder by the loop id, because a local loop's id is its folder's basename (src/server/loops.ts) and no local path ever reaches the browser.
- 2026-10-13 run 14: fleet limit stops total only loops whose count is known and name the rest ("· N not checked"), like the CI segment; one silent loop no longer hides the others. A single loop with routines off still reads "Limit stops not checked" (its count is zeroed by server, so unknown is the truth).
- 2026-10-13 run 14: a done lane hides its run-budget bar on the Lanes tab (owner's 10-11 review rule for finished cards); the header keeps "Run N/limit".
- 2026-10-13 run 14: no per-unit reviewer (pace fast: none of the units touched shared files or another lane's contract); one combined design review of the run's visual changes instead.

## Confirmed
- CONFIRMED (run 11): the e2e/dashboard server serves the self loop from dist/server/this-repo.json (copied by `npm run build`), not demo/ directly.
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
Run 14 (2026-10-13 16:43-17:15 UTC; stale clone, branch `lane-run`, pushed `HEAD:main`): final self screenshots after server's DONE core/kit snapshot (f102ef7; docs may copy `self-*`); one not-pushed sentence naming the folder (ce39885); commits-per-day day labels + full-width bars (721e95a); Health proof wraps between words (39589e3); fleet limit stops partial total (02a2b00); done lanes drop the run bar (01e8665). npm test green: 257 e2e. Design review: see `.ai/audit/web.md` (run 14).
Open minors: phone scroll rows (nav, tabs, chips) have no scroll hint in a still image; no auto-downshift notice (waiting core/server); heat-map minors + laptop empty 18-00 band; QUIET_KINDS duplicated (asked server to export it from src/server/runs.ts); network-error Retry in control dialogs.
Waiting on server: `QUIET_KINDS` export.
Gotchas: the e2e/dashboard server serves dist/: after web or demo edits run `npm run build` before a single `npx playwright test x`. Never `pkill -f` a pattern; keep the PID. A layout regression test must sweep lengths (see health.spec.ts long proof): one fixed string passed on the broken code.
Design reviewer recipe: fixture routes as in tests/e2e/pace.spec.ts, `node bin/loop.js dashboard --demo --no-open --port 4181` or `vite preview`, a node script importing `node_modules/playwright/index.mjs` with executablePath `/opt/pw-browsers/chromium`. Web lib files import core with relative `../../../src/core/*.js` (`@core` alias is Vite-only). `SCREENS=1 npx playwright test screenshots --project=laptop` re-shoots web/design/docs.
