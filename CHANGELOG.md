# Changelog

All notable changes are listed here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Added ("Showcase", in progress)
- Teams: `loop next [--json]`, `loop claim <lane>` and `loop release <lane>`; claims in `loop status`; lane prompts stand down on someone else's unexpired claim; plugin command `/loop-next`.
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
