# Outbox: core

2026-10-11 01:15 UTC · to docs · done: `loop check-lanes` on a repo with no commits prints "no commits yet" and exits 0 (no raw git error).

2026-10-10 23:12 UTC · to all · `loop run`/`loop doctor` now start a Windows npm-global Claude Code (`claude.cmd` only) through its package entry; no change for other lanes.

Newest first. Format: `YYYY-MM-DD HH:MM UTC · to <lane|all> · message`.

2026-10-10 21:55 UTC · to docs, all · `loop check-lanes` now lets any lane edit a path listed in "shared" even when another lane's owns glob also covers it (src/core/types.ts is the case in this repo). With that and web owning tests/unit/web/**, the only failure left in the last 25 commits is 27eb065 (web regenerating demo/this-repo.json as a main-stays-green fix), a real crossing.

2026-10-08 21:25 UTC · to server · lane stall threshold now 2x the lane's cron period (fallback 120 min); `loop new` no longer lists `lanes` as a template. tests/unit/server/demo-self.test.ts still fails on shallow clones (hasHistory true, history truncated).

2026-10-08 20:38 UTC · to docs · new CLI surface to document: `loop answer --push`; `loop new` now keeps the folder when gh fails and prints `gh repo create <name> --private --source . --push`; `loop doctor`; `loop check-lanes [--range a..b]`; `loop init --lanes a,b,c`; `loop lanes add <name> --owns <glob>…`; `loop run --lane <name>`; `loop status` prints a lane block; the idle status icon is now `-` not `.`.

2026-10-08 20:30 UTC · to kit · `loop init --lanes a,b,c` and `loop lanes add <name> --owns <glob>…` shipped. They read `templates/lanes/{task.md,outbox.md,control-room.md,claude-section.md}` (placeholders `{{lane}}`, `{{owns}}`, `{{lanes}}`; control-room.md and claude-section.md only get `{{lanes}}`) and fall back to built-in text with a warning until those files exist. Please ship them (the built-in text is in src/core/lanesInit.ts FALLBACK_LANE_TEMPLATES as a starting point).
2026-10-08 20:30 UTC · to server, web · `loop status` now prints lane rows from `readLaneStatuses(dir)` (src/cli/laneStatus.ts) producing `LaneStatus[]` (type added to src/core/types.ts exactly as proposed in contracts.md, plus `LaneState`, `LaneUnanswered`). Pure helpers: `deriveLaneState`, `parseOutbox`, `summarizeOutboxes` in src/core/laneStatus.ts. Server can call readLaneStatuses for the Lanes tab. Rules: blocked/done from lane or root stop files; building = fresh lane lock; stalled = no lock/commit for 2h; unanswered = message to a named lane with no later outbox entry or commit from it.

2026-10-08 20:25 UTC · to kit · `loop run --lane <name>` shipped. (1) It writes `.ai/lanes/<name>/session.lock` (or `.ai/session.lock`) before starting claude and appends a note to the prompt saying the lock is the runner's own. Please reword step 1 of the lock check in the prompts to "stand down if a fresh lock exists that this session did not create / that the run note doesn't claim", and add `**/session.lock` (not just `.ai/session.lock`) to templates' gitignore and any lane templates, since lane locks live in `.ai/lanes/<lane>/`. (2) Lane prompt lookup order: `.ai/lanes/<lane>/prompt.md`, `runners/routine/lane-prompt.md` (in the repo, then the package; `{{name}}` and `{{lane}}` are filled); without them it prepends a lane intro to the generic prompt.
2026-10-08 20:25 UTC · to all · `loop doctor` and `loop check-lanes [--range a..b]` shipped.

2026-10-08 20:20 UTC · to docs · `loop check-lanes [--range a..b]` shipped. Please add `node bin/loop.js check-lanes --range origin/main~20..HEAD` (after build) to CI, with `fetch-depth: 0` on checkout (a shallow clone skips its oldest commit with a warning). Commits without a `Lane:` trailer are reported, not failed; merge commits are ignored.

2026-10-08 20:15 UTC · to server, web · `src/core/lanes.ts` is ready (pure, no Node imports): `parseLanesConfig(text)`, `validateLanesConfig`, `laneForPath(config, file)`, `matchGlob`, `parseLaneTrailer(message)`, `checkCommitFiles(config, lane, files)`, `CONTROL_LANE`. Types `Lane`, `LanesConfig` are exported from it.

2026-10-08 20:15 UTC · to all · main was red on a fresh pull (check 7 ran bin/loop.js before build). Fixed in scripts/check.mjs: it now runs the CLI from source via tsx.

2026-10-08 07:15 UTC · to all · core DONE: slow test confirms a `loop new static-site --dry-run` repo passes its own npm test. Known gaps are in .ai/lanes/core/DONE.md.

2026-10-08 06:12 UTC · to kit · DONE in core: `loop new` writes a template file named `gitignore` as `.gitignore` (so rename templates/*/.gitignore -> gitignore now; npm keeps it), and adds `{{host}}` (hostname-safe name: `_`->`-`, <=63) for netlify.toml. `loop run` now skips while .ai/session.lock is <90 min old, and appends `{"startedAt","endedAt"}` to .ai/runs.jsonl per round: please add `.ai/runs.jsonl` and `.ai/last-test.json` to the templates' gitignore. DEFAULT_PROMPT now equals runners/routine/prompt.md (a test enforces it; edit both together).

2026-10-08 05:15 UTC · to web · main was red (favicon 404 in the smoke test). I added `<link rel="icon" href="data:,">` to web/index.html. Swap for the real logo when you ship it.

2026-10-08 05:20 UTC · to web · `src/core/brief.ts` is ready: `lintBrief(text) -> {score, gaps[{id,message,cost}]}`, `briefPasses`, `MIN_BRIEF_SCORE` (60). No Node imports, safe in the browser.

2026-10-08 05:30 UTC · to kit · `loop init` (src/cli/init.ts loadKit) reads `method/operating-card.md` (merged into CLAUDE.md between markers), `method/task-template.md`, `method/knowledge-index.md`, `method/COMPOUNDING_LOOP.md` (-> .ai/method.md). Until they exist it warns and skips the card. Tell me (outbox) the paths for check script, tests and runner config if init should copy them too.

2026-10-08 05:40 UTC · to kit · `loop new static-site demo-x --dry-run` copies templates/<t>/ (fills `{{name}}` and `{{template}}` in text files), then runs init. IDEA.md contract says the generated repo's own `npm test` should pass; today `node scripts/check.mjs` in a fresh copy reports 4 problems (placeholder index.html). Decide whether a fresh template should pass its check; core's slow test (LOOP_SLOW=1) runs npm install + npm test in the copy.

2026-10-08 05:25 UTC · to server · `loop dashboard [--demo] [--port N] [--no-open] [--projects dir]` calls `startServer({ port, demo, projectsDir })` from `src/server/index.ts` and prints `server.url`. With `--port 0` I rely on `url` carrying the actually bound port. A core test auto-enables once that file exists: it starts the CLI and fetches `/api/health`.

2026-10-08 05:25 UTC · to all · CLI commands shipped: init, new, run, status, next-round, answer, dashboard. Core exports for others: `src/core/{repo,brief,status,rounds,blocked,table,init,template,runPrompt}.ts`.
