# Changelog

All notable changes are listed here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

## [0.4.0] - 2026-10-12

0.3.0 was never published to npm, so everything under `[0.3.0]` also ships for the first time in 0.4.0.

### Added ("Control")
- Pause and resume: `loop pause` / `loop resume` write and remove `.ai/PAUSED`; lane prompts, templates and workflows stop at their first step while it exists; plugin command `/loop-pause`.
- Run log: `loop runs` and `loop runs log` keep one line per scheduled run in `.ai/lanes/<lane>/runs.jsonl`, so missed runs are visible.
- `loop ship-check [--json]` lists what is missing before a release and exits 0 only when ready; `loop next-round --brief` (laned repos) starts the next round from a brief file.
- `.github/workflows/release.yml`: manual, dry-run by default, npm trusted publishing (OIDC, provenance, no token) behind the `release` environment. Setup: [Release](docs/release.md).
- `.github/workflows/next-round.yml`: pushing `.ai/next-round.md` starts the next round and deletes the file.
- Workflow structure tests (no token secret, `id-token: write`, `environment: release`, dispatch only).
- Dashboard controls: Runs tab with usage-limit stops, Pause/Resume, Start next round, Release and a Ready to ship panel. Each opens a prefilled GitHub page or a `workflow_dispatch` run; no tokens in the browser. Releases and Tests-over-time tabs; Inbox links to edit `BLOCKED.md` on GitHub in the static demo.
- Commit authors on the timeline, the control-room summary on the loop page, and the CHANGELOG parser behind the Releases tab.

### Fixed
- Dashboard: full commit history (no 100-commit cap), a "release waiting" attention item instead of "Nothing needs you", per-lane run limits, Contract and Decisions per lane, health rows labelled by result, dated snapshot numbers, round-done wording, no console errors, the `release` lane on release commits, and header controls that no longer wrap at phone width.
- `loop check-lanes` is stricter and knows the `release` and `control` lanes; lane runners and templates recover from a stale cloud clone.

## [0.3.0] - 2026-10-11

### Added ("Showcase")
- Teams: `loop next [--json]`, `loop claim <lane>` and `loop release <lane>`; claims in `loop status`; lane prompts stand down on someone else's unexpired claim; plugin command `/loop-next`.
- Live demo: the Pages dashboard reads this repo's commits, lanes and claims from GitHub in the browser, with a snapshot fallback and a header chip; README leads with it.
- Docs: [Work on a loop with a teammate](docs/team.md).
- Dashboard: welcome strip for first-time demo visitors, fleet cards with progress bars, Timeline grouped by day with lane colours.

## [0.2.0] - 2026-10-11

### Fixed
- The dashboard build uses relative asset paths, so the GitHub Pages demo works under `/Compounding-Loop/`.
- Windows: `npm test` passes; `loop run` and `loop doctor` start Claude Code from npm/pnpm `.cmd` shims; the session lock is kept until the work settles after Ctrl-C.

### Added ("Lanes")
- Lanes: `loop init --lanes`, `loop lanes add`, `loop run --lane`, `loop check-lanes [--range]`, lane block in `loop status`, lane health checks.
- `loop doctor`; `loop new` keeps the folder when `gh` fails; `loop answer --push`; Windows npm-global `claude.cmd` support.
- Lanes templates, lane and control-room prompts, GitHub Actions `lanes.yml`, method chapter 16 (kit).
- Dashboard: Lanes tab, fleet lane strip, toasts; sixth demo loop (this repo).
- Docs: lanes guide, comparison table, FAQ, docs-vs-`--help` check, CI `check-lanes` step.
- Dependabot config (npm weekly, grouped; GitHub Actions monthly) and `homepage`/`bugs` in package.json.

## [0.1.0] - 2026-10-08

### Added
- `loop` CLI: `init`, `new`, `run`, `status`, `next-round`, `answer`, `dashboard`.
- Local dashboard with a demo mode built from five real unattended builds.
- Method files, `static-site` and `chrome-extension` templates, runners and a Claude Code plugin.
