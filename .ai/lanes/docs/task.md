# Lane: docs — round 4 (0.4.0 "Control")

Run: 3 / 20
Status: units 1-3, 5 done; unit 4 done (dashboard.md Controls written run 3); unit 6 open
Round 3 record: `.ai/lanes/docs/done-v3.md` (`git show b3b51a5:.ai/lanes/docs/task.md` for its Decisions).

## Contract
**Goal:** the release and next-round workflows, and pages that explain every dashboard control (IDEA.md Round 4 E).
**Done when:** `npm test` passes; Round 4 audit section with no open blocker; workflow structure tests pass (no token secret in `release.yml`, `id-token: write`, `environment: release`, `workflow_dispatch` only, dry-run input); the fresh-install test (README quick start, `docs/team.md`, `docs/release.md` dry run) from a packed tarball in an empty temp dir is recorded in `.ai/audit/docs.md`.
**Out of scope:** the UI (web), CLI behaviour (core). Never dispatch a workflow, create a tag, or change repo, environment or npm settings.

## Units, in order
1. Round 4 re-audit (`.ai/audit/docs.md`).
2. `.github/workflows/release.yml` (IDEA.md E) with a dry-run input, plus a test that parses it and asserts the rules above (`actionlint` too if it is available in CI without network).
3. `.github/workflows/next-round.yml` (on push touching `.ai/next-round.md`; uses core's `loop next-round --brief`), tested the same way.
4. `docs/release.md` (owner's one-time setup: npm trusted publisher + `release` environment with a required reviewer, then "click Release") and `docs/dashboard.md` (every button, what it opens, what it changes in the repo).
5. README (the dashboard runs the loop with no tokens), CHANGELOG `[Unreleased]` for 0.4.0 (honest note that 0.3.0 was never published), `launch/` drafts mention the controls; Pages workflow still deploys on `web/**`, `demo/**`, `src/server/**`, `src/core/**`.
6. Fresh-install test, then audit majors.

## Decisions
- Run 2: stale clone (local main diverged), worked on `lane-run`, pushing `HEAD:main`. README/CHANGELOG describe the CLI controls as fact and the dashboard controls generally; docs/dashboard.md waits until web ships the buttons so it documents what exists.

## Confirmed

## Guesses

## Handoff (run 3)
Next: audit majors (none open); release.yml dry run needs GitHub. Possibly lane DONE if audit has no open blockers.

## Tried

## Don't
- Edit paths another lane owns, except for the "main stays green" fix.
- Change `version`, publish, dispatch `release.yml`, create tags, or change repo/npm settings.
