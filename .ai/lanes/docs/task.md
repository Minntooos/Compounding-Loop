# Lane: docs

Run: 0 / 30
Status: not started

## Contract
**Goal:** everything that makes a stranger understand, trust and star the project in 30 seconds, plus the launch drafts (IDEA.md must-haves 25–27).
**Done when:**
- `npm test` passes; add checks to `scripts/check.mjs` (shared file, small edit) that README has the install command and proof table, and that every relative link in README and `docs/*.md` resolves.
- `README.md`: one-line pitch, screenshot (generated from the demo dashboard with Playwright into `docs/assets/`; until web has a Fleet screen, leave a clearly marked placeholder and come back), `npx compounding-loop init`, proof table (five live sites with their real `*.netlify.app` URLs, pages, tests, hours, from `.ai/reference/five-sites/`), how it works (Mermaid or SVG diagram), honest comparison with "just loop the agent", FAQ (cost, safety, what it won't do).
- `docs/`: getting started, concepts (Operating Card, task contract, knowledge, reviewer gate, session lock, budgets), runners (routine, GitHub Actions, local), dashboard tour, templates, FAQ, troubleshooting (the five-hour limit, stale sandbox clones, blocked pushes).
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant, attributed), `SECURITY.md`, `CHANGELOG.md`, `.github/ISSUE_TEMPLATE/*`, `.github/pull_request_template.md`, `.github/workflows/ci.yml` (runs `npm test` on push and PR; needs no secrets), and `.claude-plugin/marketplace.json` when kit asks.
- `launch/`: `show-hn.md`, `x-thread.md`, `reddit-claudeai.md`, `devto-article.md` ("What I learned letting Claude Code build 215 pages unattended": real failures: rate-limit starvation, stale sandbox clones, the session lock, the reviewer gate), `linkedin.md`, `good-first-issues.md` (5), `social-preview.svg` + a 1280×640 PNG rendered with Playwright.
**Constraints:** honest claims only, each backed by a number from the reference data or the repo. No posting, no publishing. The repo is currently `Minntooos/Compounding_Loop`; write links as `https://github.com/Minntooos/compounding-loop` (the owner renames it before launch) and record that under Decisions.
**Out of scope:** product code.

## Units, in order
1. `.github/workflows/ci.yml`, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG, issue/PR templates.
2. README first draft with the proof table from the reference data.
3. `docs/` concepts + getting started.
4. `launch/` drafts.
5. Social preview SVG + PNG.
6. Dashboard screenshot/GIF once web's Fleet ships (watch web's outbox).
7. README/docs pass against the real CLI `--help` output; fix every mismatch.

## Decisions
(none yet: write "decision · reason · how to reverse")

## Confirmed
(facts proven by a command or test; cite path:line)

## Guesses
(unproven beliefs; never treat one as fact in a later run)

## Tried
(what failed and why, so the next run does not repeat it)

## Don't
- Edit paths another lane owns (CLAUDE.md lane table), except for the "main stays green" fix.
- Add a dependency without a Decisions entry.

## Handoff
(each run ends by writing: where it stopped, the exact next step, anything half-done)
