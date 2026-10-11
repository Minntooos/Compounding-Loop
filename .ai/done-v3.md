# Round 3 (0.3.0 "Showcase"): DONE

Written by the control room, 2026-10-11 ~14:20 UTC, on main at 4a797ed.

## What was built
- Live demo from GitHub (browser-safe parsers in core, mappers in `src/server/live/`, fetch/cache/fallback in web), self-build snapshot through 0.2.0, welcome strip, progress-first fleet cards, day-grouped lane-coloured timeline, run/commit chart, phone nav, `web/DESIGN.md` with before/after screenshots.
- Teams: `loop next`, `loop claim`, `loop release`, claim rule in runners/templates/`runPrompt.ts`, `docs/team.md`.
- README, launch drafts and CHANGELOG `[Unreleased]` updated.

## Verified by the control room
- `npm test` green on a fresh checkout (check, typecheck, unit, build, 120 e2e passed, 30 skipped by design). Mocked-GitHub e2e (live, 403 fallback, copy command) and axe in both themes at 1440/375 px are part of it.
- `npm pack --dry-run`: no `.ai/`, root IDEA/CLAUDE, tests or reference data. No secrets or owner email in the repo. `loop check-lanes` over 26 recent commits: clean.
- JS bundle about 125 kB gzip (limit 300). `docs/assets/screens/` has 26 images. All five audits have a Round 3 section with no open blocker.
- Fresh-install test: tarball installed in an empty dir, `loop --version`, `doctor`, `next` work; docs lane recorded the full README + `docs/team.md` walkthrough in `.ai/audit/docs.md` (PASS). `init` needs a brief with a checkable done-when (documented).

## Minor findings left open
- core: SIGKILL leaves a stale lock until the 90-minute expiry; `.ai/last-test.json` has no writer; only `loop run` reads the lock pid.
- web: self-build card story line can contradict its Done badge when live data is stale; README self-build screenshot is not pixel-compared with the newest UI.
- Unsure: the self card's live-site URL is assumed to be the GitHub Pages URL.

## Owner's release checklist
1. Review the dashboard at https://minntooos.github.io/Compounding-Loop/ once Pages redeploys.
2. In the owner's local Claude Code: bump version to 0.3.0, finalise CHANGELOG, run `npm test`, then publish after approval.
3. Post the drafts in `launch/`.
