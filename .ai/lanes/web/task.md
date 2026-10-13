# Lane: web — round 5 (0.5.0 "Cockpit")

Run: 8 / 20
Status: units 1-5 parts done (C3 waits on server); C6 done in run 7; C7 chips done; next: C6 screenshot design pass, then C3/C9 when server ships slot `kind` / pace routes
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
Run 7 (2026-10-13 09:43-10:00 UTC; stale clone, branch `lane-run`, pushed `HEAD:main`) shipped C6: `NextRoundDialog.tsx` (Ingredients groups with counts, brief box with live score + costliest missing part, local *Draft with Claude* via `streamDraftBrief` in api/client.ts reading the SSE with `takeSseEvents`, Stop/Retry draft/Put back my text, demo *Copy prompt for Claude Code* or the `--print-prompt` command when `draftInputs` is absent, *Start round N* as its own click). ControlBar's ConfirmDialog no longer handles next-round. Pure parts in web/src/lib/draft.ts (unit: tests/unit/web/draft.test.ts); e2e tests/e2e/next-round.spec.ts (4 tests incl. axe). Review recorded in `.ai/audit/web.md` (C6 review, run 7).
Also run 7: server's 0208898 put quiet slots (kind not-due/paused/done, outcome no-run-recorded) into `LoopDetail.runs`; the Runs tab now drops them via `listedRuns` (web/src/lib/runs.ts) so they are not "No run recorded" rows or silent-lane streaks.
Do first next run: screenshot design pass on the C6 dialog (1440 + 375, both themes; recipe below), then C3 heat map (data is on main: `LoopRun.kind`, quiet slots, `runOutcomes.paused`; contracts.md "Heat-map data (run 7)"), then C9 (server b6ffbb6: `LoopDetail.pace`, `POST /pace`, policy.json URL builders; DESIGN.md entry first).
Waiting on server: `draftInputs` on LoopDetail + claude abort on Stop (asked 09:58); demo self lane states. Minor: QUIET_KINDS is duplicated in web/src/lib/runs.ts and src/server/runs.ts (could become one core constant).
Open minors: `cardBadge` ignores a loop pause; "Limit stops not checked" while routines look off; Retry after "committed but not pushed" re-posts (ConfirmDialog and NextRoundDialog). Design reviewer recipe: fixture routes as in tests/e2e/lane-schedule.spec.ts, `vite preview --port 4180`, Playwright executablePath under /opt/pw-browsers; never `pkill -f` a pattern matching your own shell. Web code imports core with relative `../../../src/core/*.js` in lib files Vitest loads (`@core` alias is Vite-only).
