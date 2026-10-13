# Round 4 (0.4.0 "Control"): DONE — release waiting on you

Written by the control room, 2026-10-12 ~12:50 UTC, on main at 2db1394.

## What was built
- Dashboard bug fixes (A1–A9): full history, "release waiting" attention item, per-lane limits, Contract/Decisions per lane, result-labelled health, snapshot dates, round-done wording, no console errors, lane `release`.
- Repo state (B): `loop pause/resume`, run log (`loop runs`), `loop next-round --brief`, `loop ship-check`, CHANGELOG parser, commit authors, control-room summary, stricter `check-lanes`, stale-clone recovery in runners/templates.
- Dashboard controls (C): Runs tab, Pause/Resume, Start next round, Release, Ready to ship, each opening prefilled GitHub pages. `release.yml` and `next-round.yml`, `docs/release.md`, `docs/dashboard.md`.

## Verified by the control room
- `npm test` green on a fresh checkout (check, typecheck, unit, build, e2e 144 passed, 30 skipped by design).
- `npm pack --dry-run`: no `.ai/`, IDEA/CLAUDE, tests or reference data. No secrets or owner email. JS bundle 136 kB gzip (limit 300).
- Fresh install from the packed tarball in an empty dir: CLI runs, `new`, `run --dry-run`, `doctor`, `dashboard`, `init --lanes`, `run --lane --dry-run`, `pause`, `ship-check --json` work.

## Unsure / not verified
- `release.yml` dry run needs GitHub and was never run. `loop new` could not create a GitHub repo in the sandbox (no `gh` GraphQL); folder creation was fine.
- `check-lanes` flags 6c68e31 (kit edited `src/core/runPrompt.ts` to mirror a runner prompt, recorded under "main stays green").
- Core minor: stale lock after SIGKILL untested; `.ai/last-test.json` has no writer (run log carries test counts).
- Web minor: some phone tab clipping/scroll cue, health rows read "proj1..5" in snapshot, no after-screenshots for Runs/Paused/Ready-to-ship (snapshot has no run log), dark variants of some screens not reviewed.
- Core: `git pull/push` in `src/cli/pause.ts` lack a timeout and `GIT_TERMINAL_PROMPT=0`.

## Owner's release checklist
1. In your local Claude Code: bump `version` to 0.4.0, finalise CHANGELOG, run `npm test`.
2. Approve, then run the Release workflow (dry run first) or publish via your usual path.
3. Post the drafts in `launch/`.
