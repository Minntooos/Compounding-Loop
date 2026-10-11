# Round 2 (0.2.0 "Lanes"): DONE

Written by the control room, 2026-10-11 ~03:40 UTC.

## What was built
Lanes: `loop init --lanes`, `loop lanes add`, `loop run --lane`, `loop check-lanes` (ownership by `Lane:` trailer, enforced in CI), lane templates and the plugin commands in kit, outbox and control-room messaging, a dashboard that shows lanes, `loop doctor`, a rewritten README (lanes story, comparison, FAQ), docs/lanes.md, rewritten launch drafts, CHANGELOG 0.2.0 list. Windows fixes (`claude.cmd` shims, EBUSY-safe tests). All five lanes have DONE.md.

## Verified by the control room on commit e1f69d2
- `npm test` (check, typecheck, unit, build, e2e): exit 0; 92 e2e passed, 26 skipped (screenshot spec, by design).
- `npm run check`: 302 files OK. `npm pack --dry-run`: no `.ai/`, root `IDEA.md`/`CLAUDE.md`, `tests/`, or reference data (only `templates/**` files, which are meant to ship).
- Leak grep: no secrets, no owner email.
- Fresh-install test: `npm pack`, install tarball in an empty dir, `--version`, `new static-site my-site`, `run --dry-run`, `status`, `dashboard --no-open` all work. (`new` without `--dry-run` tries `gh repo create`; this sandbox blocks it, the folder is kept as documented.)
- `.github/workflows/ci.yml` has the three jobs (ubuntu Node 20 and 24, windows Node 24). Not run from here; the owner should confirm they are green on GitHub.
- `check-lanes` over the last 50 commits reports 2 historical crossings (docs `.tmp-t.mts`, a stray file already deleted; web `demo/this-repo.json`). Not reverted, main is green.
- Version is still 0.1.0, nothing published.

## Minor audit findings left open
- core 6: SIGKILL leaves a stale lock (expires after 90 min by design); `claude` child may outlive the parent on Ctrl-C.
- core 7: `.ai/last-test.json` is not written by anything (needs a decision on who runs tests).
- core: round-1 gaps (stray dot in status, folder removal when gh fails, `answer` not pushing) were listed "open, unit 8"; core's DONE says finished, but not independently re-checked.
- docs audit rows 2-5 still say "open (planned)" but the README, lanes docs and launch drafts they refer to have since been written; the table is stale.
- `check-lanes` in a repo with no commits prints a raw git error.

## Unsure
- CI on Windows was not observed by me; earlier Windows fixes came from the owner's local run.
- Claude Code installed via npm on Windows (`claude.cmd`) was fixed in code and tested with fake shims only.

## Owner's release checklist
1. Confirm the latest CI run on `main` is green on all three jobs.
2. Local Claude Code: bump `version` to 0.2.0, finalise CHANGELOG, run `npm test`.
3. After you approve: `npm publish`, tag and GitHub release.
4. Re-run the fresh-install test against the published package.
5. Post the drafts in `launch/` yourself.
