# IDEA: Compounding Loop

## Round 5 (current): 0.5.0 "Cockpit" — see everything, steer anything, idle for free — started 2026-10-13 01:30 UTC

Round 4 finished (root report `.ai/done-v4.md`) and **0.4.0 is published on npm** (tag `v0.4.0`). The owner audited the 0.4.0 dashboard at 1440 and 375 px and wrote the end-state vision (https://claude.ai/artifact/KZwwmdiDfSAXXAtRfC3krJ, private to the owner; everything a lane needs is restated here). This round is the first step of that vision.

**What we are building:** Compounding Loop, a CLI, a local dashboard and templates that run unattended, verified Claude Code build loops. **Audience:** solo developers and small teams who run Claude Code loops from scheduled cloud routines, `loop run`, or the runners in `runners/`. They want to leave it running, glance at it, and steer it without opening a chat.

**The new headline:** *Glance, steer, sleep.* In 5 seconds the home screen answers: does anything need me, is anything running or stalled, did runs hit the usage limit, is CI green, is it ready to ship. Any lane or unit can be steered with one typed sentence, which is saved as a file in the repo. Lanes with nothing to do cost almost nothing, so a loop can stay on around the clock.

**Principles (unchanged):** the repo is the source of truth. The static demo acts only by opening prefilled GitHub pages; the local `loop dashboard` acts on disk. No tokens in the browser, no backend, no telemetry. Everything new must work for any user's laned loop (the kit templates and `loop init --lanes`), not only for this repo's routines.

### How runs work from this round (already set up by the owner's Claude Code)
- **Thin routine prompts.** Each routine prompt now only names the lane and says "follow `.ai/lane-run.md`" (the control room: `.ai/control-run.md`). The procedure lives in the repo, so changing it is a commit. Only `Lane: control` commits may edit these two files.
- **`.ai/schedule.json`** decides whether a lane is due: `{"version":1,"lanes":{"<lane>":{"notBefore":ISO|null,"sleeping":bool,"paused":bool,"reason":string|null}}}`. A run that isn't due replies "Not due" and stops before `npm install`, so a skip costs seconds. The control room, `loop schedule …` and the owner/dashboard write it with `Lane: control`; a lane may change only its own entry, and only to apply the idle backoff at the end of its run (`lane-run.md` step 8). The file starts with every lane due.
- **`.ai/lanes/<lane>/steer.md`**: steering notes, newest first. Each entry is a heading `## YYYY-MM-DD HH:MM UTC · <author> · next-run|standing` followed by the text. At the start of a run, the lane reads the entries it hasn't acknowledged. `next-run` entries come before its own unit order, and `standing` entries apply until they're removed. The lane acknowledges each entry by adding one line under it: `→ done in run N` or `→ not done: <why>`. That is the only edit a lane makes to the file.

### Step 1 for every lane: a short re-audit (first unit)
Add a "Round 5" section at the top of `.ai/audit/<lane>.md`: this round's goal judged as a demanding senior specialist would judge it, findings ranked blocker/major/minor with evidence and a one-line fix. Findings in another lane's area go to that lane's outbox. Fix blockers first.

### A. P0 bugs on the 0.4.0 dashboard (each needs a test that fails before the fix)
1. **The release stays "waiting on you" after it shipped.** Shipped = the tag `v<version>` exists, plus npm `latest` equals that version when it can be checked (`registry.npmjs.org` sends `Access-Control-Allow-Origin: *`, so the static demo can read it; add it to the static CSP `connect-src`). Shipped shows "0.4.0 released <date>" and leaves the attention list.
2. **Phantom "no run recorded" slots** (167 of them) and next-run times while nothing is scheduled. Don't expect runs after root `DONE.md`, while `.ai/PAUSED` exists, for a lane with DONE/BLOCKED, for a lane that isn't due in `schedule.json`, or after 6 h with no run from any lane (show "Routines look off" once instead).
3. **Health shows OK for checks that were never measured.** Use three states: pass, fail, "not checked" (grey, with how to check).
4. **Tests says "UTC UTC"**; the banner count disagrees with the Inbox (2 vs 1). Both come from one shared function.
5. **The demo's proj2 shows round 6/6**: a `done-v5.md` that is a handoff note was counted as a round. Count rounds from the brief or round headings, not from file names alone.
6. **Phone:** the nav and the loop tab bar are clipped ("Settin", "Contrac") at 375 px. The tab bar scrolls sideways with a fade, and the active tab is always in view.
7. **Local fleet cards lack CI, tests and the live domain**, which the demo cards have. Same card, same fields, in both modes.
8. **Small:** the loop header repeats the round; the Release blocker sentence has a double colon; only about 25 of roughly 65 round 4 runs are in runs.jsonl (runs that end early must still log, see `lane-run.md` step 8).
9. **The brief score misreads round briefs.** `loop next-round --brief` scored this very brief 25/100, because `lintBrief` (src/core/brief.ts) only matches whole headings such as `## Done when`. It also has to accept `### Round N done when`, `**Out of scope:**` and bold lead-ins such as `**What we are building:**` / `**Audience:**`, and A–E lists as must-haves. This brief must score at least 85. The Next-round dialog shows this score, so it has to be right.

### B. Schedule, steering and run outcomes (core + kit + server)
1. **`loop schedule`** (core): `show [--json]`, `pause <lane> [--reason]`, `resume <lane>`, `snooze <lane> <until>`, `wake <lane|all>`, and `update`. `update` is pure backoff from runs.jsonl:
   - a run with no units counts as idle;
   - 1 idle run → `notBefore` = last run + 3 h; 2 in a row → + 6 h; 3 in a row → `sleeping: true`;
   - any run with units resets the count;
   - a sleeping lane wakes (`sleeping: false`, `notBefore: null`) when it has an unacknowledged steer entry, an outbox or control-room message addressed to it newer than its last run, or a new round starts.
   Commands commit with `Lane: control` (`--no-commit` to skip). The parser and the due/backoff logic are browser-safe pure functions, unit-tested with fixtures.
2. **`loop steer <lane> "<text>" [--standing] [--author <name>]`** (core) writes a steer entry (author defaults to `git config user.name`), wakes the lane in `schedule.json` and commits. Browser-safe steer parser: entries, author, scope, acknowledgement state.
3. **Run outcomes** (core, browser-safe): classify each expected slot as worked (units, pushed), idle (no units), not due (`schedule.json` said skip), likely running (inside its 50-minute window with no line yet), limit stop or failed (due, the window passed, no line), paused or done. Feeds the heat map and the Runs tab. No extra commit per run start.
4. **Draft the next brief** (core + server): `loop next-round --draft [--out .ai/next-round.draft.md]` builds a prompt from root/lane DONE files (their "next 10" lists), open audit findings, unacknowledged steer entries and IDEA.md's out-of-scope. It runs `claude -p` through the existing `runPrompt` (no new auth), writes the draft and prints its brief score. `--print-prompt` prints only the prompt, for people who want to paste it into Claude Code themselves.
5. **Kit:** templates for `.ai/lane-run.md`, `.ai/control-run.md`, `.ai/schedule.json` and `steer.md`. `loop init --lanes` writes them. The runner prompts and the CLAUDE.md template say "follow `.ai/lane-run.md`". Method §16 gains "thin prompts, schedule, steering". Tests assert every runner and template has the not-due skip, the steer step, the run-log step and the stale-clone step.
6. **Server API** (record it in `.ai/contracts.md`):
   - `GET /api/loops/:id/schedule`
   - `POST …/steer {lane, text, standing}`
   - `POST …/schedule {action, lane, until?, reason?}`
   - `POST …/draft-brief`, which streams `claude -p` progress over SSE and ends with the draft and its score
   - npm state for the Releases view
   All writes go through the core commands. Static demo: pure URL builders for "edit `steer.md` on GitHub with this entry prefilled" and "edit `schedule.json`". The demo snapshot gets run-log, schedule and steer fixtures, so every new screen has real-looking data (the web lane was blocked on this in round 4).

### C. The cockpit (web, on Opus, with the server's data)
1. **Status strip** at the top of every page: loop state (running / likely running / idle / sleeping / paused / done / release waiting), round and done-when progress, CI, usage-limit stops in the last 5 h, next due lane. One line on desktop, two on phone.
2. **Needs you**: every attention item is a row with its action inline. Release waiting → Review & release. BLOCKED question → Answer (local) or Edit on GitHub (demo). Stalled or limit stops → What this means + Wake. Round done → Start next round. The banner count and the Inbox come from the same list.
3. **Lane × hour heat map**, last 24 h, one cell per expected slot, coloured by the B3 outcome, with a legend. A tooltip and a click take you to that run in the Runs tab. Folds to 12 h at 375 px.
4. **Steer composer** (button on every lane, unit and the loop page, key `S`, and in the command palette):
   - pick the scope (loop → which lane, or lane → which unit) and the timing (next run / standing);
   - type plain language;
   - see the exact `steer.md` entry before saving.
   Locally it saves through the API ("Save" / "Save and wake"). On the demo it opens GitHub's editor prefilled. The steer history shows on the lane with each entry's acknowledgement.
5. **Schedule controls** on each lane: Pause lane / Resume, Snooze until…, Wake now, with the state shown ("sleeping since 14:00 · 3 idle runs"). Pause all stays.
6. **Next round with "Draft with Claude"**: the dialog shows the ingredients (next-10 lists, open findings, steers). Draft with Claude streams the local draft into the brief box. On the demo, a "Copy prompt for Claude Code" button. The live score shows as you edit. **Go** is a separate, explicit click.
7. **Releases**: each version with its CHANGELOG entry, tag, npm state (published / latest / not published) and date. Ready-to-ship only when not shipped.
8. **Design bar:** extend `web/DESIGN.md` for every new component first. After each web unit, an **independent design reviewer subagent** (fresh context; it wrote none of the code) looks at the 1440 and 375 px screenshots of the changed screens in both themes. It must answer the owner's five 5-second questions from the home screen alone (anything need me? running or stalled? limit stops? CI? ready to ship?) and list anything that's noise. Fix what it flags before the next unit and record its verdict in `.ai/audit/web.md`.

### D. Docs
- `docs/steering.md`: steer at each level, the schedule and backoff, what "not due", "sleeping" and "likely running" mean, and how thin prompts work (with the exact routine prompt text to copy).
- `docs/dashboard.md`: update for every new control and what it writes.
- README: a "Glance, steer, sleep" section.
- CHANGELOG `[Unreleased]` for 0.5.0.
- New after-screenshots (from web), optimised PNGs under 400 kB each.
- `launch/` drafts mention steering and idle-for-free.

### Round 5 done when
- `npm test` passes on a clean clone and on CI's three jobs.
- Every lane's audit has a Round 5 section with no open blocker; every A bug has a regression test.
- Unit tests cover `loop schedule` (each action, backoff and wake rules, `--json`), `loop steer`, the steer and schedule parsers, run-outcome classification (every outcome), `next-round --draft --print-prompt` (no Claude call in tests), and the kit templates (they contain the skip, steer, run-log and stale-clone steps).
- e2e with GitHub and npm mocked through Playwright routing proves:
  - the status strip states for the demo data;
  - Needs-you rows with their actions;
  - heat-map outcomes and the legend;
  - steer composer preview, plus the exact prefilled GitHub URL on the demo;
  - schedule controls;
  - the Draft-with-Claude stream on a mocked SSE endpoint;
  - Releases showing 0.4.0 as published;
  - phone tab bars not clipped;
  - zero console errors.
- axe: zero serious or critical violations on every screen, both themes, at 1440 and 375 px. No horizontal page scroll at 375 px.
- Independent design review verdicts recorded for every web unit, with the five questions answered "yes" from the final home screenshot.
- JS bundle under 300 kB gzip. Fresh-install test (README quick start, `loop init --lanes` writes the new templates, `docs/steering.md` steps) from a packed tarball in an empty temp dir.
- **Do not change `version`, publish, dispatch `release.yml` or create tags.** The owner's local Claude Code releases 0.5.0 after root `DONE.md`.

**Deadline:** 2026-10-16 18:00 UTC. After that, start no new unit: finish what's open and write DONE.

**Out of scope (later rounds):**
- Round 6: a request queue with a PR-triggered operator routine, live steering of a running session, the autonomy dial, the usage governor (status-line capture), self-starting rounds.
- Round 7: team roles and presence, multi-repo fleets, run replay, a phone app.
- Never in scope: a hosted backend, accounts, tokens in the browser, analytics, npm publish, posting the launch, repo settings changes, enabling or disabling routines.

---

## Round 4 (finished 2026-10-12; published as 0.4.0 on 2026-10-13): 0.4.0 "Control" — the dashboard tells the truth and replaces the chat — started 2026-10-11 20:30 UTC

Round 3 finished (root report `.ai/done-v3.md`; release commit b3b51a5 bumped to 0.3.0 but it was **not published**; 0.4.0 will be the next npm release). The owner reviewed the live demo at 1440 and 375 px against git, the task files, CI and the live sites; that review is this brief. The launch posts wait for this round.

**The new headline:** *Run the loop from the dashboard, not from a chat.* In rounds 1–3 the owner and their local Claude Code went back and forth on the same things every round: "status?", why did a run end in 1 second, switch six routines on and off, start a round, publish (npm tokens were pasted into chat three times), "is it ready to ship?". Each of those becomes a click or a short typed answer in the dashboard. **Principle: the static dashboard acts only by opening prefilled GitHub pages (create/delete a file, the Actions "Run workflow" page). No tokens in the browser, no backend; it works for anyone with write access to the repo.** The local `loop dashboard` may do the same actions directly on disk.

### Step 1 for every lane: a short re-audit (first unit)
Add a "Round 4" section at the top of `.ai/audit/<lane>.md`: this round's goal judged as a demanding senior specialist would, findings ranked blocker/major/minor with evidence and a one-line fix. Findings in another lane's area go to that lane's outbox. Fix blockers first.

### A. Bugs the owner found on the live demo (each needs a test that fails before the fix)
1. **Commit history stops at 100 commits.** The chart shows 16 commits on 8 Oct; git has 109, and the timeline loses round 1. Fix: the bundled snapshot carries full history up to its pinned commit; live mode fetches only commits `since` the snapshot's last commit (paging if more than 100), and the two are merged without duplicates.
2. **"Nothing needs you" is false** while a release waits for the owner. A root `DONE.md` means "round done, release waiting on you": show it in the attention list and as the self card's state.
3. **Self loop Settings:** "Run limit 0" (lanes have 20: show the per-lane limit from the task files) and "Site" shows the GitHub repo instead of the Pages URL (both come from the live config).
4. **Contract tab is blank** with no empty message; **Knowledge and Decisions say "none"** although every lane task file has a Decisions section. For a laned loop, show each lane's Contract and Decisions, grouped by lane; every tab has an empty state.
5. **Health:** a passing check reads "OK · Tests failing" (the label is the check's name). Labels state the result ("Tests pass", "Tests failing"). Times are formatted (`11 Oct 14:53 UTC`), never raw ISO.
6. **Site cards show 6 Oct numbers under a "Live" header** with no date. Snapshot data always says "snapshot 6 Oct" (date from the data); only live data says Live.
7. **"Round 3 of 3"** with a full bar reads as finished forever. Show "Round 3 done · 0.3.0" and what's next (release waiting / next round not started).
8. **Small:** the `api/settings.json` 404 console error on every visit (zero console errors, tested); the release commit is tagged lane "other" (read the `Lane:` trailer first, then the subject prefix; `Release x.y.z` subjects are lane "release"); on the phone the theme button wraps onto its own row.
9. **Site loops:** show the page count (`pages` is in the data) and a link to the live site on the loop page and card.

### B. Repo state the dashboard reads (core + kit + server)
1. **Pause:** a file `.ai/PAUSED` (one line: who and when, optional reason) stops every lane run and the control room, like root `DONE.md`. `loop pause [--reason]` / `loop resume` write/remove it and commit with `Lane: control`; `loop status`, `runPrompt.ts`, every runner prompt and template (kit), and this repo's CLAUDE.md honour it. So routines can stay enabled and the repo decides.
2. **Run log:** at the end of every lane run (success or not), the run appends one JSON line to `.ai/lanes/<lane>/runs.jsonl` (its own folder, so no conflicts): `{"at","lane","session"?,"units":[...],"tests":{"passed","failed"}?,"pushed":true|false,"note"?}`. `loop runs log …` writes a line (runners call it); a browser-safe parser reads it. Expected runs come from each lane's `cron` in `.ai/lanes.json`: a scheduled slot with no line and no commit is shown as **"no run recorded (usage limit, idle or failed)"**; a line with `pushed:false` is "ran, pushed nothing". This also gives tests over time and gives `.ai/last-test.json` a writer (or replaces it; record the choice).
3. **Lanes-aware next round:** `loop next-round --brief <file>` for a laned repo: puts the brief as IDEA.md's first section (previous "current" heading renamed to finished), archives root and lane `DONE.md` files as `done-vN.md`, resets each lane's task file from the template (Run 0/limit, unit 1 = audit), adds a control-room note, commits with `Lane: control`. `--dry-run` lists the changes. The brief score from `loop init` is shown before writing and in `--json`.
4. **Ship check:** `loop ship-check [--json]` (not `release`, that name is taken by claims): root `DONE.md` present, open findings listed in it, CHANGELOG has a section for `package.json`'s version or `[Unreleased]` with content, the tag `v<version>` does not exist yet, working tree clean, `npm test` result from the run log. Exit 0 only if ready. Browser-safe pure core so the dashboard can show the same checklist.
5. **Releases list:** a browser-safe CHANGELOG parser (versions, dates, entries).
6. **Commit author** on `LoopCommit` (display name only, never email); **control-room summary:** the newest line of `.ai/control-room.md` per lane (newest `to <lane|all>` note).
7. **`check-lanes`:** a commit with `Lane: release` may touch only `package.json`, `package-lock.json`, `plugin/**/plugin.json` and `CHANGELOG.md`; `Lane: control` may touch `.ai/**`, `IDEA.md` and root `DONE.md`.
8. **Stale-clone recovery** in the kit's lane prompt templates and runners: if `git pull --ff-only` fails because the clone started from an old copy, `git fetch origin main`, work on a branch from `origin/main`, push with `HEAD:main`; never blame a force-push without checking `git log origin/main`.

### C. The dashboard replaces the back-and-forth (web, data from server)
Each row is a must-have; the "GitHub link" builders are pure functions of the repo slug in the static config, unit-tested.
| Back-and-forth (rounds 1–3) | Dashboard replacement |
|---|---|
| "status?" → RemoteTrigger list, list_runs, get_run_log, git log | **Runs tab** on the loop page: per lane, each run's time, outcome (pushed / nothing pushed / no run recorded / failed tests), units, commits, tests. Fleet card: the newest run outcome in its one status line. |
| Runs ending in about 1 s (shared five-hour limit), diagnosed by reading logs | Missing scheduled runs shown as "no run recorded" with the next expected slot; three or more in a row raise an attention item ("lanes are not running: check your plan's usage limit"). |
| Turning six routines on and off one at a time | **Pause all / Resume** button: on the static demo it opens GitHub's "new file" page prefilled with `.ai/PAUSED` (Pause) or the file's delete page (Resume); locally it runs `loop pause/resume`. The card shows "Paused by X since HH:MM". |
| Starting a round (brief, archive, reset, enable, "go") | **Start next round**: a text box for the brief with the live brief score; on the static demo it opens GitHub's "new file" page prefilled with `.ai/next-round.md`, and a workflow (docs) runs `loop next-round --brief .ai/next-round.md` on that push, deletes the file and commits. Locally it runs the command. |
| Release: bump, CHANGELOG, test, pack, publish, tag; tokens pasted in chat | **Release** button that opens the Actions "Run workflow" page of `release.yml` (docs): npm **trusted publishing** (OIDC, `id-token: write`, `npm publish --provenance`), no token anywhere, behind a GitHub environment `release` that the owner protects with a required reviewer. The dashboard shows the ship-check list and the last release run's result. |
| "Is it ready to ship?" | **Ready to ship** panel when root `DONE.md` exists: the ship-check items, open findings from `DONE.md`, the CHANGELOG entry, links to the `launch/` drafts with Copy buttons. |
| A stale clone made a run blame a force-push | Runs that pushed nothing are flagged (above); the recovery step is in the templates (B8). |
| Who pushed what (unknown identity, a teammate's local runner) | Commit author on the timeline next to the lane. |
| Overnight monitoring by a session cron that dies with the session | The control room's newest note per lane on the self card and loop page. |
| Answering a BLOCKED.md | On the static demo, the Inbox links to GitHub's web editor for that file; locally the Inbox stays as it is. |
| `gh auth refresh -s workflow` and other one-time setup | `loop doctor` output on the Health page (local server; the static demo shows "run `npx compounding-loop doctor` locally"). |

### D. Where detail goes
- **Fleet card = a 5-second glance:** state word + icon, one line on what's happening or what's needed, progress, last activity (absolute time). No charts, no tables.
- **Loop page (opt-in detail):** existing tabs, plus **Runs**, **Tests** (count over time from the run log, last failure with its commit), **Releases** (versions with their CHANGELOG entries), and for site loops: pages, live-site link, Search Console clicks/impressions only when the local server has a key configured (never in the static demo).
- Everything stays to `web/DESIGN.md`; extend it (Runs, Releases, Ready-to-ship, action buttons) before building them.

### E. Docs and workflows (docs)
- `.github/workflows/release.yml`: `workflow_dispatch` only, `environment: release`, `permissions: contents: write, id-token: write`; steps: checkout, Node 24, `npm ci`, `npm test` (or the CI-equivalent subset, recorded), `loop ship-check`, fail if the version is already on npm, `npm publish --provenance --access public` (trusted publishing; no `NODE_AUTH_TOKEN`), tag `v<version>`, GitHub release from the CHANGELOG section. A dry-run input that stops before publishing.
- `.github/workflows/next-round.yml`: on push to `main` touching `.ai/next-round.md`: run `loop next-round --brief .ai/next-round.md`, delete the file, commit with `Lane: control`, push. Ignore pushes where the file is absent.
- `docs/release.md`: the owner's one-time setup in plain steps (npmjs.com → package → Trusted publisher: GitHub Actions, repo, `release.yml`, environment `release`; GitHub → Settings → Environments → `release` → required reviewer), then "click Release". `docs/dashboard.md`: what every button does and what it changes in the repo.
- README: the dashboard can run the loop (pause, next round, release) with no tokens; CHANGELOG `[Unreleased]` lists 0.4.0 (keep the `[0.3.0]` section; 0.3.0 was never published, say so honestly in 0.4.0's notes); `launch/` drafts mention the controls.

### Round 4 done when
- `npm test` passes on a clean clone and on CI's three jobs (ubuntu Node 20 and 24, windows Node 24).
- Every lane's audit has a Round 4 section with no open blocker; every bug in A has a regression test.
- e2e with GitHub responses mocked through Playwright routing (no real network) prove: full history beyond 100 commits (snapshot + live merge), "release waiting on you" in the attention list when root `DONE.md` exists, the Runs tab with each outcome (pushed, nothing pushed, no run recorded), Pause/Resume/Start next round/Release open the exact prefilled GitHub URLs, Ready to ship shows the ship-check items, zero console errors.
- axe: zero serious/critical violations on every screen including the new ones, both themes, 1440 and 375 px; no horizontal scroll and no wrapped header controls at 375 px.
- `loop pause/resume/runs/ship-check/next-round --brief` are unit-tested (including `--json` shapes and `--dry-run`); every runner prompt and template is tested to contain the PAUSED rule, the run-log step and the stale-clone step.
- `release.yml` and `next-round.yml` pass `actionlint` (or a YAML + structure test if actionlint is unavailable) and a test asserts `release.yml` has no token secret, has `id-token: write`, `environment: release` and `workflow_dispatch` only.
- An independent reviewer subagent checks every new screen against `web/DESIGN.md`; result recorded in `.ai/audit/web.md`. New after-screenshots in `docs/assets/screens/`.
- JS bundle under 300 kB gzip. Fresh-install test (README quick start, `docs/team.md`, `docs/release.md` dry run) from a packed tarball in an empty temp dir. `npm pack --dry-run` follows the round 1 rules.
- **Do not change `version`, do not publish, and never dispatch `release.yml` or create tags.** Lanes do not change repo settings, environments or npm settings. The owner's local Claude Code releases 0.4.0 after root `DONE.md`.

**Deadline:** 2026-10-14 18:00 UTC. After that, start no new unit: finish what's open and write DONE.

**Out of scope:** a hosted backend or database, accounts, tokens or OAuth in the browser, analytics or tracking, non-Claude agents, new site templates, npm publish, posting the launch, repo settings changes, enabling or disabling routines.

---

## Round 3 (finished 2026-10-11; bumped to 0.3.0 in b3b51a5, not published, folded into 0.4.0): 0.3.0 "Showcase" — the dashboard as the launch, plus teams — started 2026-10-11 04:30 UTC

0.2.0 is published on npm (2026-10-11, tag `v0.2.0`). The launch (one Show HN, then Reddit/X/LinkedIn/dev.to) waits for this round: the owner posts only after looking at the finished dashboard. Round 2's report is `.ai/done-v2.md`.

**The new headline:** *Open the demo and watch the repo that built this tool, live.* The GitHub Pages demo (https://minntooos.github.io/Compounding-Loop/) stops being a frozen sample: it reads this public repo from GitHub in the visitor's browser (lanes, run counters, commits, CI) and falls back to a bundled snapshot. And it must look like a product a senior designer shipped, not an MVP.

**What the owner saw on 2026-10-11 (fix all of it):** the first thing a visitor reads is a grey "Sample data: no dashboard server is running…" line that looks like an error, with no line saying what this is or how to install it; the self-build card says "Round 1/2", "Tests: no result", "Live: not checked"; cards are plain text tables with no sense of progress; the Timeline is one long flat commit list with no lane colour and "3d ago" times that rot; at 375 px the nav wraps ("New / loop") and the theme button sits on its own row; one 404 in the console.

### Step 1 for every lane: a short re-audit (first unit)
Add a "Round 3" section at the top of `.ai/audit/<lane>.md`: this round's goal judged as a demanding senior specialist would, findings ranked blocker/major/minor with evidence and a one-line fix. Findings in another lane's area go to that lane's outbox. Fix blockers first.

### 0.3.0 must-haves (each needs a test before it counts)
1. **Design spec first (web).** Research how well-regarded developer dashboards solve the same problems (e.g. Vercel, Linear, GitHub Actions, Grafana, Railway, Sentry: status at a glance, timelines, progress, empty/loading/error states, phone layouts). Use WebSearch; describe patterns in your own words, never copy their text, images or code. Write `web/DESIGN.md`: the problems in today's UI (with "before" screenshots), the patterns chosen and why, layout per screen, type scale and tokens (keep IDEA.md "Design": calm mission control, the same token palette unless a contrast fix needs a change, recorded), components, charts, motion, states, phone layout. Every later web unit is judged against it.
2. **Live demo from GitHub (server + web + core).** In the static demo build only, the dashboard reads `Minntooos/Compounding-Loop` live, unauthenticated, from the visitor's browser: commits (`api.github.com`), `.ai/lanes.json`, each lane's task file, DONE/BLOCKED markers and outbox, root DONE.md (`raw.githubusercontent.com`), and the latest CI run on main. The repo slug comes from a config file in the static export, not hardcoded in components. Cache for 5 minutes per tab, refresh every 5 minutes while the tab is visible, a quiet "Live · updated 14:05 UTC" indicator. On any error or rate limit (60 requests/hour/IP), fall back to the bundled snapshot and say "Snapshot from <date>" calmly. No tokens, no cookies, no analytics. The static export's CSP allows `connect-src` to exactly those two GitHub hosts; the local `loop dashboard` server's CSP and behaviour are unchanged (it reads disk). Split: **core** adds browser-safe pure parsers (no `node:` imports) for lanes.json, task files (run N/LIMIT, status, handoff) and `Lane:` trailers, used by both server and web; **server** owns `src/server/live/**`: pure functions that map GitHub API/raw responses to the same API types the dashboard already renders, the static export config, and the CSP; **web** fetches, caches, and renders. The other four demo sites stay a snapshot.
3. **Self-build history (server).** The bundled snapshot of this repo covers rounds 1 and 2 (pin the 0.2.0 release commit 084bb9f), with a round counter that reads like a story ("Round 2 of 2 done · 0.2.0 shipped", not "1/2"), test counts from the recorded results, and the Pages URL as its live check.
4. **Dashboard that is not an MVP (web)**, built to `web/DESIGN.md`:
   - A welcome strip for first-time visitors in demo mode that replaces the grey banner: one sentence on what this is, the copyable `npx compounding-loop dashboard` command, GitHub link, and the live/snapshot indicator. Dismissible; never shown when a local server is running.
   - Fleet cards that show progress at a glance (round progress, run budget bar, state word + icon, last activity), with the self-build card visually first.
   - Loop detail: a Timeline grouped by day, lane-coloured, filterable by lane, with absolute UTC times (relative on hover); a small runs/tests-over-time chart per loop (hand-written SVG or a dependency under 15 kB gzip, recorded in Decisions); lane rows with claims (must-have 5).
   - Phone (375 px): nav that fits (scrollable tabs or a menu), no horizontal scroll, no wrapped labels.
   - Empty, loading, error and rate-limited states for every screen; both themes; reduced motion; no console errors (fix the 404).
5. **Teams: share a loop without handing anything over (core + kit + web + docs).** A teammate clones the repo and their own Claude Code reads everything it needs from the repo; nothing private is ever passed by hand.
   - `loop next [--json]`: lists open units across all lanes (from task files), with claims, and recommends one unclaimed unit.
   - `loop claim <lane> [--as <name>] [--minutes 90]` writes `.ai/lanes/<lane>/claim` (one line: `name · expires <UTC>`), commits it with a `Lane: <lane>` trailer and pushes; `loop release <lane>` removes it. An expired claim counts as no claim. `loop status` and the dashboard show claims.
   - Runners honour claims: the lane prompts in `runners/` and the templates (kit), and `runPrompt.ts` (core), say "if `.ai/lanes/<lane>/claim` names someone else and has not expired, reply Nothing to do and stop."
   - `docs/team.md`: "Work on a loop with a teammate" in five steps (clone, `loop next`, `loop claim`, `loop run --lane`, `loop release`), linked from the README.
6. **Docs and launch (docs):** README's first screen leads with the live demo link and new screenshots (from web), the team workflow, an honest FAQ line on GitHub rate limits; `launch/` drafts point at the live self-build; CHANGELOG `[Unreleased]` lists 0.3.0; the Pages workflow still deploys on changes to `web/**`, `demo/**`, `src/server/**`, `src/core/**`.

### Round 3 done when
- `npm test` passes on a clean clone and on CI's three jobs (ubuntu Node 20 and 24, windows Node 24).
- Every lane's audit has a Round 3 section with no open blocker.
- Live demo: e2e tests with GitHub responses mocked through Playwright routing (no real network in tests) prove (a) live mode renders lanes, run counters, commits and CI state from the mocks, (b) a 403/rate-limit response falls back to the snapshot with its notice, (c) the welcome strip copies the install command.
- axe: zero serious/critical violations on every screen, both themes, at 1440 and 375 px; no console errors; no horizontal scroll at 375 px.
- **Design review:** `web/DESIGN.md` exists; before/after screenshots of every screen in both themes are in `docs/assets/screens/`; a reviewer subagent that did not build the UI checks each screen against DESIGN.md, and the result (every item pass, or fixed) is recorded in `.ai/audit/web.md`.
- JS bundle under 300 kB gzip.
- `loop claim/release/next` are tested: expiry, a claim by someone else, `--json` shape, and `check-lanes` accepts a claim commit in its own lane.
- Fresh-install test (docs runs it, the control room re-runs it): `npm pack`, install the tarball in an empty temp dir, follow the README quick start and `docs/team.md` word for word.
- `npm pack --dry-run` follows the round 1 rules.
- **Do not change `version` and do not publish.** The owner's local Claude Code releases 0.3.0 after root `DONE.md`.

**Deadline:** 2026-10-13 18:00 UTC. After that, start no new unit: finish what's open and write DONE.

**Out of scope:** a hosted backend or database, accounts, auth tokens in the browser, analytics or tracking, non-Claude agents, new site templates, npm publish, posting the launch, repo settings changes.

---

## Round 2 (finished 2026-10-11, shipped as 0.2.0): "Lanes" + launch readiness — started 2026-10-08 19:40 UTC

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
