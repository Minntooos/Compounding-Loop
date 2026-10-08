# IDEA: Compounding Loop

## Round 2 (current): 0.2.0 "Lanes" + launch readiness — started 2026-10-08 19:40 UTC

0.1.0 is published on npm and the demo is live (https://minntooos.github.io/Compounding-Loop/). It has not been announced yet. The launch is a single Show HN; it happens after this round, so this round decides the first impression. Round 1's report is `.ai/done-v1.md`.

**The new headline:** *Several unattended lanes, one repo, no merge conflicts.* This repo was built that way (five lanes + a control room, in parallel, on `main`). 0.2.0 lets any user do the same with one command. Parallel-agent tools already exist (Claude Squad, Parallel Code, Agent Orchestrator, Vibe Kanban, Conductor, Claude Code's own worktrees and agent teams). They are interactive and worktree-based, and they leave merging to the human. Our niche is the **unattended, multi-day** version: path ownership instead of merges, outboxes instead of chat, a control room instead of a human, and a check that enforces it all. Claim only what we ship and test.

### Step 1 for every lane: the audit (first unit, before any feature)
Review your own area as a demanding senior specialist would, and write `.ai/audit/<lane>.md`: the checklist in your task file with pass/fail, then findings ranked **blocker** (a first-time user fails, is misled, or leaves) / **major** (looks unfinished to a careful reader) / **minor**. Every finding has evidence (command + output, or `path:line`) and a one-line fix. Findings in another lane's area go to that lane's outbox, not into its files. Fix your blockers before 0.2.0 features. Fit majors in between features, in order of user value. List the minor findings you didn't fix in your DONE.md.

### 0.2.0 must-haves (each needs a test before it counts)
1. **Lane config** `.ai/lanes.json`: `{ "lanes": [{ "name", "owns": [globs], "cron"? }], "shared": [globs] }`. It is the single source of truth. This repo has one; read it as the example. Pure parser + validator in `src/core/lanes.ts` (no overlapping `owns` between lanes, valid names, at least one lane).
2. **`loop init --lanes <a,b,c>`** (and `loop lanes add <name> --owns <glob>…`): writes `.ai/lanes.json`, `.ai/lanes/<lane>/task.md` + `outbox.md` from templates, `.ai/control-room.md`, and the lane section of `CLAUDE.md`/`AGENTS.md`. Idempotent; never overwrites without `--force`.
3. **Ownership check** `loop check-lanes [--range <a..b>]`: each commit with a `Lane: <name>` trailer may only touch that lane's `owns` + `shared` (+ `.ai/lanes/<name>/**`). Exits non-zero with a message that names the file, the lane, and how to fix it. Commits without a trailer are reported, not failed (humans commit too). Wired into this repo's CI and into the templates' CI.
4. **Runners for lanes:** a lane prompt and a control-room prompt in `runners/routine/` (generalised from this repo's real ones in `.ai/reference/routines/`), staggered cron generated per lane, and a GitHub Actions matrix workflow (one job per lane, `max-parallel: 1`, `concurrency` per lane).
5. **`loop run --lane <name>`**, which also writes `.ai/session.lock` (per lane: `.ai/lanes/<name>/session.lock`) and clears it. This closes the known gap where nothing writes the lock.
6. **Lanes in `loop status` and the dashboard:** per loop, each lane's state (building/waiting/blocked/done), run N/LIMIT, last commit, and unanswered outbox messages ("web waits on server"). Demo mode gets a sixth demo loop: **this repo building itself**, from a scrubbed snapshot of its own lane files and commit history.
7. **`loop doctor`:** checks node ≥ 20, git, gh (+ auth), claude, and a Playwright browser, and says how to fix each failure.
8. **Docs + launch for the new headline:** `docs/lanes.md`, a README rework (lanes in the first screen, honest comparison table with the tools above, FAQ for "isn't this cron + `claude -p`?", "what does it cost?", "why not agent teams?"), rewritten `launch/` drafts, and `CHANGELOG.md` `[Unreleased]` listing everything in 0.2.0.

### Round 2 done when
- `npm test` passes on a clean clone, on CI's three jobs (ubuntu Node 20 and 24, windows Node 24).
- Every lane has written `.ai/audit/<lane>.md`, and no blocker in it is still open.
- Each 0.2.0 must-have has a test. `node bin/loop.js init --lanes a,b --dry-run`, or the same in a temp dir, produces a repo whose `loop check-lanes` passes. A commit that breaks ownership makes it fail.
- **Fresh-install test** (docs lane runs it, the control room re-runs it): `npm pack`, then install the tarball in an empty temp dir, then follow the README quick start word for word. Every step works with no step that isn't written down. Record it in `.ai/audit/docs.md`.
- `npm pack --dry-run`: same rules as round 1 (no `.ai/`, root `IDEA.md`/`CLAUDE.md`, tests or reference data).
- **Do not change `version` in package.json and do not publish.** The release (0.2.0 bump, tag, `npm publish`) is done locally by the owner's Claude Code after the control room writes root `DONE.md`.

**Deadline:** 2026-10-11 18:00 UTC. After that, start no new should-level unit: finish what's open, write DONE. A good launch on time beats a perfect one later.

**Out of scope this round:** non-Claude agents, a hosted version, new site templates (Astro/Python), npm publish, posting the launch, repo settings changes.

---

# Round 1 brief (0.1.0, finished 2026-10-08; kept as the product's foundation)

## One line
An open-source kit plus a local dashboard: you write a one-page brief, and Claude Code builds the project in scheduled, unattended runs until checks prove it is finished. Every run is tested and reviewed, remembers what it learned, and stops by itself when it finishes or gets stuck.

**Promise (README headline):** *Write the brief, check back tomorrow.*

**Proof:** this exact method built five live calculator sites (215 pages, all tested) in two days with nobody watching. Real data from those sites is in `.ai/reference/five-sites/` and becomes the demo. The method is in `method/COMPOUNDING_LOOP.md`. The owner's first, hand-made dashboard is in `.ai/reference/old-dashboard/` (single HTML file + a Node collector); read it for ideas, don't copy its structure.

## Who it is for
1. Solo builders and indie hackers who already pay for Claude Code and want it working while they sleep.
2. Freelancers and small agencies running several client builds at once who need to see them all in one place.
3. Developers who tried autonomous agents and got burned by work that looked done but wasn't. Verification is the selling point.

## Why it wins against "just run the agent in a loop"
1. Nothing is done until a check says so: check script, browser tests, and a reviewer subagent that attacks each diff before push.
2. The repo is the memory: contract, handoff, decisions and knowledge live in `.ai/` files, so every fresh run resumes exactly where the last stopped.
3. It stops safely: run budget, `DONE.md`, `BLOCKED.md`. Never burns usage forever, never ships guesses.
4. One screen for every loop: the dashboard answers "does anything need me?" in two seconds.

## Names (final)
- Product: **Compounding Loop**. npm package: `compounding-loop` (free on 2026-10-07). Command: `loop`.
- GitHub repo: currently `Minntooos/Compounding_Loop`; the owner renames it to `compounding-loop` before launch. Write every repo URL in docs as `https://github.com/Minntooos/compounding-loop` (GitHub redirects the old name).
- License: MIT. Copyright holder: "Minntooos".

## Scope of v1 (local-first, $0 to run)
| | In v1 | Not in v1 |
|---|---|---|
| Install | `npx compounding-loop init` into a new or existing repo | Hosted SaaS |
| Agent | Claude Code (CLI, routines, GitHub Action) | Codex, Gemini CLI, Cursor (v2; `AGENTS.md` keeps the method agent-neutral) |
| Templates | Static niche site (proven), Chrome extension | Full-stack app template (v1.1) |
| Runners | GitHub Actions cron, Claude Code routines, local scheduler | Its own cloud runner |
| Dashboard | Fleet, Loop detail, Inbox, New-loop wizard, Health, Settings, First run, Demo mode | Team accounts, sharing, comments |
| Data | Read from git: `.ai/` files, `DONE.md`, `BLOCKED.md`, commits | Its own database |
| Integrations | GitHub via the user's `gh` CLI | Search Console, Netlify, Vercel (v1.1 plugins) |
| Money | None inside the product | Payments, licence keys |

**The rule that keeps scope honest:** the dashboard never stores state the repo doesn't. Any runner, on any machine, shows up correctly as long as it pushes to git. The only local file is a settings file listing which repos/folders to watch.

## Must have (v1) — each needs an automated test before it counts
### CLI (`src/cli`, lane `core`)
1. `loop init` — adds the method to any repo: Operating Card in `CLAUDE.md` + `AGENTS.md`, `.ai/` (index, task, log, method), check script, tests, runner config. Idempotent; never overwrites user files without `--force`.
2. `loop new <template> [name]` — creates a repo from a template (`gh repo create`, private by default) and walks through the brief with @clack/prompts. `--dry-run` writes locally without touching GitHub (used by tests).
3. Brief linter (`src/core/brief.ts`) — scores `IDEA.md` 0–100 and names what is missing: audience, must-haves that are vague, no checkable done-when, no out-of-scope. `loop init`/`new` refuse to start a loop on a score under 60 unless `--force`.
4. `loop run` — runs one build round now, locally (`claude -p` with the same prompt the scheduler uses).
5. `loop next-round` — after `DONE.md`: archives it as `.ai/done-vN.md` and writes the next round's `.ai/task.md` from its "next 10" list.
6. `loop status` (should) — fleet table in the terminal. `loop answer` (should) — answer a `BLOCKED.md` from the terminal, commit, restart.
7. `loop dashboard [--demo] [--port]` — starts the local server and opens the browser.

### Context engineering (`method/`, `templates/`, lane `kit`)
8. Operating Card: always-loaded rules, under 60 lines; everything else loads on demand.
9. Task contract and handoff (`.ai/task.md`): goal, done-when commands, Confirmed vs Guess, Tried, Decisions.
10. Knowledge and triggers: short index + entries that load only when a file/error matches; lessons get promoted into automated checks.
11. Reviewer gate: a subagent that didn't write the code attacks every diff before push.
12. Session lock (`.ai/session.lock`, 90 min) so two runners never build the same thing.
13. Run budget and stop files: `Run: N / 30`, `DONE.md`, `BLOCKED.md`.
14. Templates: `static-site` (generalise the proven starter in `templates/static-site/`) and `chrome-extension` (MV3, Playwright extension tests).
15. Runners: `runners/github-actions/loop.yml` (scheduled workflow using `anthropics/claude-code-action`, secret name `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` documented, never stored), `runners/routine/prompt.md` (+ generated staggered cron), `runners/local/` (cron on macOS/Linux, Task Scheduler XML on Windows).
16. Claude Code plugin (`plugin/`): `/loop-init`, `/handoff`, `/retro`, `/stuck` commands; installable with `/plugin marketplace add Minntooos/compounding-loop`.

### Server (`src/server`, `demo/`, lane `server`)
17. Hono API on Node, Server-Sent Events for live updates; reads git with the `git`/`gh` binaries via `execFile` (never a shell string, never stored tokens). Watches clones and fetches every 5 minutes.
18. Demo mode: `loop dashboard --demo` serves a scrubbed snapshot of the five real sites (`demo/`), and a static export of the demo is deployable to GitHub Pages.

### Dashboard (`web/`, lane `web`)
19. Fleet: "Needs you" bar first, one card per loop (status word + icon + colour, round 3/5, run 12/30, next run, tests, live check), sorted by attention.
20. Loop detail: header (live URL, runner); tabs Timeline (runs as commits), Contract (done-when checklist with pass/fail), Knowledge, Decisions, Settings.
21. Inbox: every BLOCKED question in one list with the agent's best guess pre-filled; Accept guess or write an answer → commits and restarts.
22. New-loop wizard: Brief (live linter score) → Template → Runner; creates the repo end to end.
23. Health: private files served publicly (leak check), stale lock, runs dying in ~1 s (rate limit), failing tests, runner silent longer than 2 cron periods.
24. First run: "Try the demo" or "Create your first loop". Settings: projects folder, GitHub account (via `gh`), default runner, theme.
Should: compounding chart (lessons learned and failures caught by checks over time), live updates without refresh.

### Docs and launch (lane `docs`)
25. README that converts in 30 s: 15-s GIF/screenshot of the dashboard, one-line pitch, `npx compounding-loop init`, proof table (5 live sites, pages, tests, hours), how it works, honest comparison.
26. Docs site in `docs/` (plain Markdown is fine, published with the GitHub Pages demo), CONTRIBUTING, CODE_OF_CONDUCT, issue/PR templates, 5 "good first issue" drafts in `launch/good-first-issues.md`.
27. Launch kit in `launch/`: Show HN post, X thread, r/ClaudeAI post, dev.to write-up "What I learned letting Claude Code build 215 pages unattended" (real failures: rate-limit starvation, stale sandbox clones, the session lock, the reviewer gate), LinkedIn post, social preview image (1280×640 PNG generated from an SVG in the repo). Drafts only: the owner posts them.

## How status is worked out (same rules for every runner)
1. `BLOCKED.md` exists → **Blocked**.
2. `DONE.md` exists → **Done** for this round; rounds done = number of `.ai/done-vN.md` files.
3. `.ai/session.lock` under 90 min old, or last commit under 60 min old → **Building**.
4. Otherwise → **Waiting**, next run from the runner's cron.
5. Any health check failing overrides the label with **Failing** and a reason.

## Design (calm mission control)
- Within two seconds it says whether anything needs you; otherwise quiet. Dense, dark-first, one accent colour, no decoration that doesn't carry information (Linear/Vercel feel).
- Principles: "Needs you" first (at zero it says "Nothing needs you" in plain green) · every number links to its proof (commit, file line, run log) · status never colour alone (word + icon) · motion only for change (a card pulses once on push; respect reduced motion) · keyboard first (Ctrl/⌘K palette, j/k move, a answers).
- Tokens (dark / light): background `#0B0D10`/`#FAFAFA`, surface `#13161B`/`#FFFFFF`, border `#232831`/`#E4E6EA`, text `#E6E8EB`/`#111318`, muted `#8B93A1`/`#5B6370`, accent `#8B7CFF`/`#6C5CE7`, building `#4C8DFF`/`#2563EB`, blocked `#F5A524`/`#B45309`, done `#3DDC97`/`#15803D`, failing `#F04D4D`/`#DC2626`.
- Type: Inter for UI, JetBrains Mono for hashes/paths/cron (self-hosted via `@fontsource`, no Google Fonts call at runtime). Body 14 px, labels 12, headings 20/28. 4 px grid, 8 px radius, 1 px borders.
- Logo: a loop arrow that opens into a rising spiral (SVG in `web/public/logo.svg`).
- Fleet and Inbox work at 375 px phone width; the wizard is desktop-first. WCAG AA in both themes, full keyboard use, visible focus.

## Stack
TypeScript on Node 20+ · CLI: commander + @clack/prompts · server: Hono + @hono/node-server + SSE · git/gh via `execFile` · web: Vite, React 19, Tailwind v4, shadcn/ui-style components (copied in, not a runtime CDN), cmdk, lucide-react · TanStack Query · Recharts · tests: Vitest (logic) + Playwright (dashboard in demo mode) · release: Changesets + npm provenance (the owner runs the first `npm publish`).

## Done when (the whole product)
- `npm test` passes on a clean clone (check + typecheck + unit + build + e2e).
- Each Must-have above has a test that exercises it; `.ai/lanes/*/DONE.md` exist for all five lanes.
- `node bin/loop.js new static-site demo-x --dry-run` produces a repo whose own `npm test` passes.
- `node bin/loop.js dashboard --demo` shows the five real sites correctly (e2e asserts the numbers in `.ai/reference/five-sites/`).
- README, docs and launch kit complete; `npm pack --dry-run` contains no `.ai/`, `IDEA.md`, `CLAUDE.md`, tests or reference data.

## Out of scope (v1)
Hosted version, accounts, payments, analytics/telemetry of any kind, non-Claude agents, Search Console/Netlify/Vercel plugins, publishing to npm or posting the launch (owner does those).
