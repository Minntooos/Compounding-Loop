# Lane: server — round 4 (0.4.0 "Control")

Run: 6 / 20
Status: units 1-4 done, unit 5 partly done (run 1)
Round 3 record: `.ai/lanes/server/done-v3.md` (`git show b3b51a5:.ai/lanes/server/task.md` for its Decisions).

## Contract
**Goal:** the data behind every Round 4 screen, live and local, correct (IDEA.md Round 4 A1-A9 data side, B, C, D).
**Done when:** `npm test` passes; Round 4 audit section with no open blocker; every mapper is pure, browser-safe and unit-tested against scrubbed fixtures; `.ai/contracts.md` documents every new field and endpoint.
**Out of scope:** fetching, caching and rendering in the browser (web), CLI commands (core).

## Units, in order
1. Round 4 re-audit (`.ai/audit/server.md`).
2. Self-build snapshot through round 3 (pin b3b51a5) with **full commit history**, and live `since`-the-snapshot commit URLs (paged) plus a pure merge without duplicates (A1). Commit author display name (no emails) in snapshot and live.
3. Data fixes: root DONE.md → "release waiting on you" attention item and state (A2); per-lane run limit and Pages URL in settings (A3); per-lane Contract and Decisions for laned loops (A4); health labels that state the result and formatted proof times (A5); `snapshotAt` on every snapshot loop so the UI can say "snapshot 6 Oct" (A6); round state "Round N done · version, next: …" (A7); `api/settings.json` in the static export (A8); lane from the `Lane:` trailer, then subject prefix, `Release x.y.z` = release (A8); site pages + live URL in the summary (A9).
4. Runs: map `runs.jsonl` + cron slots + commits (grouped by `Claude-Session:` trailer when present) to a `LoopRun[]` with outcome pushed / nothing pushed / no run recorded / failed tests; attention item after three missing slots in a row. Live and local.
5. PAUSED state, control-room newest note per lane, releases from CHANGELOG, ship-check items (core's pure function), and pure GitHub URL builders from the repo slug: new-file prefill (`.ai/PAUSED`, `.ai/next-round.md`), delete-file, web-editor for a file, Actions "Run workflow" page for `release.yml`, latest `release.yml` run. Local server: `loop doctor` output endpoint and direct pause/resume/next-round actions (POST, same-origin, the existing CSRF/token rules), Search Console only when a key is configured locally. Then audit majors.

## Decisions
- 2026-10-11 Release item and `releaseWaiting` only for laned loops (a finished site loop is just finished). New `InboxItem.kind` (`release`, `lanes-not-running`) lets web skip the answer form; BLOCKED.md questions keep no kind.
- 2026-10-11 A lane is "silent" only if it ever logged or committed, is not done/blocked/claimed, and `.ai/PAUSED` is absent; a slot under 90 min old is not missing yet. Reason: avoid false "lanes are not running" alarms.
- 2026-10-11 Laned `run`/`runLimit` = sum over lanes when any lane has a limit, else the root task counter (web's liveFetch test depends on that).
- 2026-10-11 `demo/build-self.mjs` now runs with `npx tsx` (reuses `taskBullets.ts`); snapshot pinned at b3b51a5, 194 commits, abbrev 7, placeholder git names (`unknown`, `read`) dropped.
- 2026-10-11 Over-long briefs: `nextRoundUrl` throws RangeError over 7500 chars; `briefFitsUrl` tells web to offer Copy + blank new-file page.

## Confirmed
- `git fetch --unshallow` was needed for the snapshot build (cloud clones are shallow); the build test is skipped on shallow clones.

## Guesses

## Tried
- Local `main` started with unrelated history; reset to origin/main (old state in branch `backup-stale-main`, not pushed).

## Don't
- Edit paths another lane owns, except for the "main stays green" fix.
- Change `version`, publish, dispatch `release.yml`, create tags, or change repo/npm settings.

## Handoff (run 6)
Fresh pull green (140 e2e, unit, build). No unit open; no new asks to server in any outbox. Same optional leftovers as run 5.

## Handoff (run 5)
Fresh pull green (138 e2e, unit, build). No new code: remaining items are optional/minor. (c) Search Console only with a local key (not started; needs a key and network, nothing in the brief requires it). (e) the pinned self snapshot (b3b51a5) predates run logs, so it has no `runs`; `releases` could be parsed from CHANGELOG at the pin. readSilentItem repeats readTimeline/readRuns per inbox poll (cache per tick if it ever shows slow). Local main was stale (diverged); worked on branch lane-run, pushing with `git push origin HEAD:main`.

## Handoff (run 4)
Shipped: `tagLookupApiUrl` (matching-refs, no 100-tag cap); `LiveInput.tags` accepts both responses. Web may switch its tags fetch to it (not required). Remaining: (c) Search Console only with a local key, (e) self snapshot has no runs/releases, readSilentItem duplicate git work per poll (minor).

## Handoff (run 3)
Shipped: local `ship` field in `readLoop` (src/server/loops.ts `readShipGit`). Remaining: (c) Search Console only with a local key, (e) self snapshot has no runs/releases; audit majors: readSilentItem duplicate git work per poll, tags API beyond 100 tags. laneDetails ask from web is already served by `laneNotes`.

## Handoff (run 2)
Shipped: local POST pause/resume/next-round + GET /api/doctor (src/server/index.ts, loops.ts `control`, contracts.md "Local actions"); per-clone action lock, 64 KB body cap, brief file removed on failure. Remaining unit 5: (c) Search Console only with a local key, (d) local `ship` field in `readLoop` (git tag + status), (e) self snapshot has no runs/releases; audit majors: readSilentItem duplicate git work per poll, tags API beyond 100 tags. Reviewer notes for core (src/cli/pause.ts, not mine): git pull/push there have no timeout or GIT_TERMINAL_PROMPT=0, and `runPause` fails when git user.name is unset (server passes no `as`); next-round push has no rebase retry.

## Handoff (run 1)
Done and pushed: unit 1 audit, unit 2 (full history + paged `since` URLs + `mergeCommits`), unit 3 (labels, release item, roundLabel, Pages URL, lane budgets, laneNotes, commit lanes, snapshotAt, api/settings.json), unit 4 (`src/server/runs.ts`, live + local), unit 5 first part (`src/server/controls.ts` URL builders, paused/controlNotes/releases/ship in live + local reads). contracts.md documents all of it.
Remaining in unit 5: (a) local server POST actions for pause/resume/next-round (same-origin + CSRF rules as the answer route; call core's `loop pause/resume/next-round` functions in src/cli), (b) `GET /api/doctor` returning `loop doctor` output (local only; demo returns a "run npx compounding-loop doctor" message), (c) Search Console only with a local key (never in demo), (d) local `ship` field in `readLoop` (needs tag list via `git tag` + `git status --porcelain`), (e) the self snapshot has no `runs`/`releases` (predates the run log). Then audit majors/minors: readSilentItem duplicates readLoop's git work per poll (cache per tick), tags API beyond 100 tags.
Waiting on web: wire paged live fetch (`commitsSinceUrl`), `pagesUrl`, `tags`, new fields (see outbox).
