# CLAUDE.md

## Project core

**What this is:** Compounding Loop, an open-source npm package (CLI + local dashboard + templates + Claude Code plugin) that lets anyone run unattended, verified Claude Code build loops. The brief is [IDEA.md](IDEA.md). This repo is built by its own method: five parallel **lanes**, each a scheduled run that owns one part of the codebase.

**Why it can win:** agent tools are everywhere in 2026; most show demos, not finished work. This one ships with proof (five live sites built unattended) and makes verification the product. So the bar for this repo is the same: nothing counts until a test proves it, and the code must look like something a hiring manager would be impressed by.

**Commands**
- Install: `npm install`, then `npx playwright install chromium`. If the browser download is blocked (it is in Claude's cloud sandbox), `playwright.config.ts` finds the preinstalled Chromium in `/opt/pw-browsers` or a system Chrome automatically. If Chrome fails over missing libraries: `npx playwright install-deps chromium`.
- Test (the only judge of "done"): `npm test` = `check` + `typecheck` + `unit` + `build` + `e2e`.
- Fast: `npm run check` (repo invariants), `npm run typecheck`, `npm run unit` (Vitest), `npm run build`, `npm run e2e` (Playwright, port 4173).
- Dev: `npm run dev:web` (Vite), `npx tsx src/cli/index.ts <cmd>`.

**Lanes (who owns what)** — you are told your lane by the run prompt. Edit only the paths your lane owns; read anything.
| Lane | Owns | Task file |
|---|---|---|
| core | `src/core/**`, `src/cli/**`, `bin/**`, `tests/unit/core/**`, `tests/unit/cli/**` | `.ai/lanes/core/task.md` |
| kit | `method/**`, `templates/**`, `runners/**`, `plugin/**`, `tests/unit/kit/**` | `.ai/lanes/kit/task.md` |
| server | `src/server/**`, `demo/**`, `tests/unit/server/**` | `.ai/lanes/server/task.md` |
| web | `web/**`, `tests/e2e/**` | `.ai/lanes/web/task.md` |
| docs | `README.md`, `docs/**`, `launch/**`, `.github/**`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `SECURITY.md` | `.ai/lanes/docs/task.md` |
- **Shared files** (any lane, smallest possible edit): `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `playwright.config.ts`, `vitest.config.ts`, `scripts/check.mjs`, `.gitignore`.
- **Shared types** live in `src/core/types.ts` (owned by core). Other lanes may **add** fields or types there, never rename or remove; say so in your outbox.
- **Round 2 (0.2.0 "Lanes", from 2026-10-08):** IDEA.md's first section is the current brief. Your first unit is the audit it describes. `.ai/lanes.json` is the machine-readable form of the table above; if they ever differ, `.ai/lanes.json` wins. Every commit message ends with a trailer line `Lane: <your lane>` (the control room uses `Lane: control`), so `loop check-lanes` can verify ownership. Deadline: 2026-10-11 18:00 UTC (see IDEA.md).
- **Talking to other lanes:** write only to your own `.ai/lanes/<you>/outbox.md` (newest first, `YYYY-MM-DD HH:MM UTC · to <lane|all> · message`). At the start of each run read every other lane's outbox and `.ai/control-room.md` (the supervising routine's notes) for messages to you or `all`, and act on them or note why not in your task.md.
- `.ai/contracts.md` describes the HTTP API between server and web. server owns it; web may append requests under "Requested".

**Hard rules**
- `main` stays green. If `npm test` fails on a fresh pull before you change anything, fixing it is your first unit, wherever the failure is (smallest fix; tell the owning lane in your outbox).
- Published package contents are controlled by `files` in `package.json`: only `bin/`, `dist/`, `templates/`, `method/`, `runners/`, `plugin/`, `README.md`, `LICENSE`. `.ai/`, `IDEA.md`, `CLAUDE.md`, tests and `.ai/reference/` must never ship; `npm run check` enforces it.
- No telemetry, analytics, tracking, ads, or calls home. No runtime CDN loads (fonts and icons are bundled). No secrets anywhere; tokens are read from the user's environment or `gh`, never stored or logged.
- Shell out only with `execFile`/`spawn` and an argument array, never a shell string built from input. Never put user or repo text into `innerHTML`/`dangerouslySetInnerHTML`.
- Cross-platform: Windows, macOS, Linux. Use `node:path`, never hard-coded `/`. CI-like tests must not need network access or a GitHub login (use fixtures and `--dry-run`).
- Code quality is part of the product: strict TypeScript (no `any` without a comment saying why), small pure functions in `src/core`, every exported function tested, clear names, comments only where the why isn't obvious.
- Dependencies: prefer the ones already in `package.json`. A new one needs a reason under Decisions. If `package.json` or `package-lock.json` conflicts on `git pull --rebase`, keep both sides' entries in `package.json`, then `npm install` to regenerate the lockfile, `git add` both, `git rebase --continue`, and re-run `npm test`.
- Reference material (`.ai/reference/`) is for reading. The five-site JSON there is the source for the demo snapshot; the server lane scrubs it into `demo/` (no emails, no local paths, no key paths).

---

## Operating Card (the Compounding Loop)

> The full method is in `.ai/method.md`. The § numbers point to Part B there.

**Objective:** the most verified-correct results per minute of the owner's attention. Tokens are the cheapest resource. A wrong result that looks right is the most expensive one.

**Start of every session**
1. Read `.ai/index.md`. Open a knowledge entry only when it's relevant to what you're doing.
2. If `.ai/task.md` exists, run the resume protocol (§9.2) before anything else.

**Before work**
3. Size the task. Tiny: just do it. Medium: contract + checks. Large or unclear: plan, then loop.
4. For medium and large tasks, write the contract (§5): goal, done-when (checkable by a command), constraints, out of scope.

**During work**
5. One unit of work at a time. Run the checks after each unit. You never declare done; the checks do.
6. Write a note the moment you learn something, marked CONFIRMED or GUESS. Don't save it for the end.
7. After any error, search `.ai/index.md` for the error text before trying a fix.
8. Before editing a file, check the index for entries about that path.
9. Send reading-heavy work (search, docs, logs, review) to subagents that report back in 10 lines or fewer. Keep code-writing in one thread.
10. Same failure twice: stop and run the stuck protocol (§9.3). Don't retry a variant.
11. If reality contradicts the plan or contract, stop and record it (see Unattended mode). Don't silently work around it.
12. Point to code and docs (`path:line`). Never copy them into notes.

**Context**
13. At ~50–60% context, or when a unit is done and the next one is big: run the handoff (§9.1) and end the run.

**Finishing**
14. When the checks pass, run the retro (§12), log the task and delete `.ai/task.md`.

**Never**
- Mark your own work done without the checks passing.
- Treat a GUESS from an earlier window as fact.
- Delete or rewrite CONFIRMED knowledge without new evidence.
- Change this card.

---

## Unattended mode

No human is watching. The owner reads the results later. These rules replace "ask the human". Wherever the Operating Card or `.ai/method.md` says `.ai/task.md`, read **your lane's** `.ai/lanes/<lane>/task.md`.

- **Git:** work on `main` and push to `main`, never to a `claude/` branch. Start every run with `git checkout main && git pull --ff-only`. Five lanes push to this repo, so pull again right before each push; if a push is rejected, `git pull --rebase` and push again (see the lockfile rule above). If a rebase conflicts in a file you don't own, `git rebase --abort`, record it under Tried, pull fresh, redo your small change on top, and continue.
- **Questions:** decide using IDEA.md and common sense, write the decision and the reason under **Decisions** in your task.md, then keep going. Pick the option that's easiest to reverse.
- **Plan approval:** for large units, write the plan in `.ai/plans/<lane>-<topic>.md`, have a reviewer subagent attack it ("what are the 3 most likely ways this plan fails?"), fix the plan, then build.
- **Review before every push to `main`:** `npm test` must pass. Then a reviewer subagent that didn't write the code checks the diff against IDEA.md: "Find the three most likely ways this is wrong for a real user installing this tool, and check each one." Fix any blocker first.
- **Stuck protocol, last step:** write `.ai/lanes/<lane>/BLOCKED.md` (what you tried, the specific question, your best guess), commit, push, stop. Only a problem that stops **every** lane (for example `npm install` impossible) goes in a root `BLOCKED.md`.
- **Run budget:** your task.md holds `Run: N / LIMIT`. Add 1 at the start of every run. When N reaches LIMIT, write your lane's `BLOCKED.md` saying "run budget reached", push, and stop.
- **Lane finished:** when every done-when in your lane contract passes and the reviewer finds no blockers, run the retro, write `.ai/lanes/<lane>/DONE.md` (what was built, test results, anything unsure, the 10 best next improvements for this lane ranked by value to users), keep task.md for the record, push and stop. Before writing DONE, read the other lanes' outboxes: if anyone is waiting on you, do that first.
- **If at the start of a run** root `DONE.md` or `BLOCKED.md` exists, or your lane's `DONE.md` or `BLOCKED.md` exists: do nothing and stop.
- **Root `DONE.md`** is written only by the control room, when all five lanes are done and the product done-when in IDEA.md passes.

**Never, even if it seems helpful**
- Spend money, sign up for anything, create accounts, or publish anything (no `npm publish`, no posting the launch kit, no changing repo visibility or settings, no GitHub releases).
- Add API keys, secrets, ads, analytics, telemetry or tracking code.
- Copy text, images or code from other projects without a compatible licence and attribution. Write original code and copy.
- Force-push, rewrite git history, edit another lane's owned paths beyond the "main stays green" rule, or touch anything outside this repository.
