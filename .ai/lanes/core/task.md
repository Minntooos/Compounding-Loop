# Lane: core — round 4 (0.4.0 "Control")

Run: 1 / 20
Status: in progress
Round 3 record: `.ai/lanes/core/done-v3.md` (`git show b3b51a5:.ai/lanes/core/task.md` for its Decisions).

## Contract
**Goal:** the repo state the dashboard reads and the commands behind its buttons (IDEA.md Round 4 B1-B7).
**Done when:** `npm test` passes; Round 4 audit section with no open blocker; every command and parser below has unit tests, including `--json` shapes and `--dry-run`.
**Out of scope:** UI (web), runner prompt files outside `src/core/runPrompt.ts` (kit), GitHub response mapping (server).

## Units, in order
1. Round 4 re-audit (`.ai/audit/core.md`).
2. `.ai/PAUSED`: `loop pause [--reason]` / `loop resume` (commit with `Lane: control`, push; `--no-push` for tests), `loop status` shows it, `runPrompt.ts` stops on it like root DONE.md. Browser-safe `isPaused`/`parsePaused` in `src/core/parse/**`. Tell kit and server in your outbox early.
3. Run log: `loop runs log --lane <l> [--units ..] [--passed N --failed N] [--pushed|--no-pushed] [--note ..]` appends to `.ai/lanes/<lane>/runs.jsonl`; `loop runs [--json]` lists them with expected-but-missing cron slots from `.ai/lanes.json`. Browser-safe parser + a pure `expectedSlots(cron, from, to)` (no new dependency unless recorded). Decide `.ai/last-test.json` (writer or replace) with server; record it.
4. Lanes-aware `loop next-round --brief <file> [--dry-run] [--json]` (IDEA.md B3), brief score shown first.
5. `loop ship-check [--json]` with a browser-safe pure checklist function (IDEA.md B4); browser-safe CHANGELOG parser (B5).
6. `LoopCommit.author` (display name, never email) and a browser-safe `latestControlNotes(controlRoomMd)` per lane (B6), added to `src/core/types.ts` additively; tell server.
7. `check-lanes`: `Lane: release` and `Lane: control` rules (B7), tested. Then audit majors, then minors in `.ai/done-v3.md` (stale lock after SIGKILL) by value.

## Decisions
- 2026-10-11 `.ai/last-test.json` stays (kit's templates write it; the server already reads it). `runs.jsonl` carries the history (`tests` per run). Both exist; the dashboard prefers the run log when present. Reversible.
- PAUSED format: `who · paused <ISO>[ · reason]`; the file's existence alone pauses (malformed files still count). `loop pause/resume` pull --rebase --autostash first (the dashboard writes the file on GitHub).
- DEFAULT_PROMPT stays equal to kit's runners/routine/prompt.md; the pause rule is added by `laneIntro` instead and kit adds it to its files.

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns, except for the "main stays green" fix.
- Change `version`, publish, dispatch `release.yml`, create tags, or change repo/npm settings.
