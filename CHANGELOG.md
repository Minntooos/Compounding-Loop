# Changelog

All notable changes are listed here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Fixed
- The dashboard build uses relative asset paths, so the GitHub Pages demo works under `/Compounding-Loop/`.

### Added
- Dependabot config (npm weekly, grouped; GitHub Actions monthly) and `homepage`/`bugs` in package.json.

## [0.1.0] - 2026-10-08

### Added
- `loop` CLI: `init`, `new`, `run`, `status`, `next-round`, `answer`, `dashboard`.
- Local dashboard with a demo mode built from five real unattended builds.
- Method files, `static-site` and `chrome-extension` templates, runners and a Claude Code plugin.
