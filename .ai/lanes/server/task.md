# Lane: server — round 4 (0.4.0 "Control")

Run: 1 / 20
Status: in progress
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

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns, except for the "main stays green" fix.
- Change `version`, publish, dispatch `release.yml`, create tags, or change repo/npm settings.
