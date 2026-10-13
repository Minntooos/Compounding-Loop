# Lane: server — round 5 (0.5.0 "Cockpit")

Run: 10 / 20
Status: units 1-5 + web's run-kind ask done (… + draft-brief SSE, web's routinesLookOff ask); next: unit 7 pace routes, demo self lane states, A3, A5
Round 4 record: `.ai/lanes/server/done-v4.md` (`git show 02874e8:.ai/lanes/server/task.md` for its Decisions).
How a run works: `.ai/lane-run.md` (cheap stop checks, steering, run log, idle backoff).

## Contract
**Goal:** the data and write API the cockpit needs, locally and in the static demo (IDEA.md Round 5 A1, A7, B6).
**Owns (globs from `.ai/lanes.json`):** src/server/**, demo/**, tests/unit/server/**
**Done when:**
- `npm test` passes.
- Round 5 audit section with no open blocker.
- A1 and A7 have regression tests that fail before the fix.
- Unit tests for every new route (schedule, steer, schedule actions, draft-brief SSE with a fake `claude`, npm state) and for the GitHub prefill URL builders; routes recorded in `.ai/contracts.md`.
- The demo snapshot has run-log, schedule, steer and release fixtures that exercise every outcome web shows.
**Constraints:** edit only the paths you own, plus the smallest edit to shared files (CLAUDE.md "Lanes"). Read anything. Unacknowledged `next-run` entries in `steer.md` come before this list.
**Out of scope:** UI (web), parsing and commands (core: call them, don't copy them), templates (kit).

## Units, in order
1. Round 5 re-audit (`.ai/audit/server.md`).
2. A1: release shipped detection (tag exists + npm `latest` when reachable; `registry.npmjs.org` allows CORS, add it to the static CSP `connect-src`) and npm state per version for Releases. A7: local fleet cards get the same CI, tests and domain fields as the demo.
3. Demo snapshot fixtures: runs.jsonl lines covering worked/idle/limit-stop, a `schedule.json` with a sleeping and a snoozed lane, `steer.md` with acknowledged and open entries. Web was blocked on missing fixtures in round 4; tell web in your outbox when they land.
4. Routes (B6) on top of core's commands as they land: `GET …/schedule`, `POST …/steer`, `POST …/schedule`, run outcomes from `classifyRunSlots`. Static demo: pure prefilled-GitHub-URL builders for steer and schedule edits.
5. `POST …/draft-brief`: SSE progress from `next-round --draft`, ending with the draft and its score; a fake `claude` in tests.
6. Audit majors, then minors.
7. Pace (IDEA.md B7): `GET/POST …/pace` through core's `loop pace`, pace in the demo snapshot (one lane override), and the prefilled GitHub URL builder for `.ai/policy.json`.

## Decisions
- Shipped = tag exists and (npm unreadable or npm latest == version). Local mode never calls npm (works offline). A shipped loop drops `ship` and the release inbox item; `shipped` carries version/date/npm.
- A7 site field comes from package.json `homepage` (https only): the only offline source of a live domain.

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns (a fix to a red `main` is the one exception; say so in your outbox).
- Change the Operating Card, the version, `.ai/lane-run.md` or `.ai/control-run.md`; publish, tag or dispatch `release.yml`.

## Handoff
Run 9: A3 done: `HealthCheck.state`/`howToCheck` (checkLabels.ts withLabel sets state; 3 unmeasured checks are `unchecked`), contracts + outbox to web. A5 live blocked on core (outbox ask: move countRounds to src/core/parse; then fetch IDEA.md in live/urls.ts BASE_FILES and use it). web's `kind` ask was already done in run 7. Next: live pace + live draftInputs, abortableClaude unit test, demo self building flip once web updates its e2e (see run 8), audit minors.
Run 8: web's two asks done: `LoopDetail.draftInputs` (local: src/server/draftInputs.ts mirrors core's gatherDraftPrompt; demo self: cockpit-fixture DRAFT_INPUTS) and draft-brief aborts `claude` when the SSE client stops (src/server/claude.ts abortableClaude; projectsSource takes an AbortableClaude). Tried: flipping the demo self loop to Round 5 building (lane states, snapshotAt 13 Oct) broke 7 web e2e tests (fleet/lanes/screens/cockpit expect done), reverted; web must update those first, then add `cockpitLoop(lanes)` (state building, round 5, lanes building, snapshotAt FIXTURE_NOW). Next: that, A3 HealthCheck.state, A5 countRounds in urls.ts, live pace + live draftInputs, abortableClaude unit test.
Run 7 (later): unit 7 done: LoopDetail.pace, POST …/pace (parsePaceBody, LoopControls.pace via runPaceSet), paceEditUrl/paceEditText, demo pace fixture patched into demo/this-repo.json (build-self.mjs cannot run on a shallow clone; patch the cockpit keys via cockpitFixture()). Not done: live mode does not fetch policy.json (pace absent in live). Next: demo self lane states + snapshotAt (web ask), A3 HealthCheck.state, A5 countRounds in urls.ts, audit minors, live pace.
Run 7: web's two asks done: `RunOutcomes.paused`, `LoopRun.kind` + quiet (not-due/paused/done) slots of last 24 h kept in runs (contracts, outbox warn web to filter by kind; lastRunOf skips them; MAX_RUNS 400). Reviewer: web silentLanes/RunsTab read `outcome` only (web's to fix). Known: PAUSED w/o timestamp marks all unrecorded slots paused. Next: unit 7 pace routes (GET/POST …/pace via core's paceFor/`loop pace`, demo snapshot with a lane override, policy.json URL builder), demo self lane states + snapshotAt, demo fixture kind, A3, A5.
Run 6: web's ask done (silentLanesItem skipped when routinesLookOff; local root DONE.md stops lanes) and unit 5 done: POST /api/loops/:id/draft-brief (SSE progress/draft/error, LoopControls.draftBrief, projectsSource takes an injectable ClaudeRunner, recorded in contracts). Reviewer minor, not done: client abort does not kill `claude -p` (lock held until it exits); errors carry status in the event body, not HTTP. Next: unit 7 pace routes (core's paceFor/`loop pace`), demo self loop lane states + snapshotAt (web ask), A3 HealthCheck.state, A5 countRounds.
Run 5: unit 4 done: POST /api/loops/:id/steer and /schedule (src/server/actionBody.ts parsers, LoopControls.steer/schedule in loops.ts over core's runSteer/runScheduleAction), steerNewFileUrl/steerEditUrl/scheduleEditUrl/scheduleEditText in controls.ts, contracts recorded. Reviewer: lane 'all' rejected for steer (fixed). Known minor: chunked bodies skip the 64 KB cap (as next-round). Next: unit 5 draft-brief SSE (reuse buildDraftPrompt/draftClaudeArgs/runDraft/lintBrief, fake claude in tests), unit 7 pace routes, then web's ask: demo self loop lanes should show Due/Snoozed/Sleeping (update demo/cockpit-fixture.mjs lane states + snapshotAt), A3, A5 (switch urls.ts round count to core's countRounds).
Run 4: unit 3 done: RunOutcomes/schedule/idleRuns/steer on LoopSummary/LoopDetail (runs.ts outcomesOf, loops.ts, live/build.ts; live now fetches schedule.json + steer.md, was missing), demo/cockpit-fixture.mjs feeds this-repo.json (no nextRuns on purpose, see contracts). Next: unit 4 POST …/steer & …/schedule + prefilled GitHub URL builders, then 5 draft-brief SSE, 7 pace, A3 HealthCheck.state, A5 round count from headings (core's countRounds). Reviewer idea not done: end-to-end tests of readLoop/buildLiveLoop for schedule/steer fields.
Run 3: A2 done: buildRuns takes `schedule` (not-due slots dropped from missing/silent) and returns `routinesLookOff` (stopped lanes/all-stopped = done). Not yet surfaced on LoopSummary/LoopDetail (web asked for `runOutcomes`; needs a shape + wiring in loops.ts/live/build.ts). Still to do: A3 HealthCheck.state, A5 round count from headings, units 3-5 (fixtures first, web is waiting).
Run 2: shipped now also needs tag not older than DONE.md (local mode only; live has tag names only, no dates: still open for live); annotateReleases leaves tag/npm absent when unchecked. Still to do: A3 HealthCheck.state/howToCheck, A5 round count from headings (core's countRounds in src/core/repo.ts), A2 classifyRunSlots in src/server/runs.ts, then units 3-5.
Run 1: unit 1 (audit) and unit 2 (A1 shipped detection incl. per-release tag/npm state, CSP, A7 local card fields) done with regression tests. Next: unit 3 (demo fixtures: demo/build-self.mjs / this-repo.json get runs.jsonl lines, schedule.json, steer.md), then units 4-5 once core ships `loop schedule`/`loop steer`/`classifyRunSlots` (check src/core/parse for them). The 'phantom run slots' (A2) fix needs core's classifier.
