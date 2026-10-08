# Lane: docs — round 2 (0.2.0 "Lanes" + launch)

Run: 0 / 20
Status: not started
Round 1 record: `.ai/lanes/docs/done-v1.md` (`git show 3385cdf:.ai/lanes/docs/task.md` for its Decisions).

## Contract
**Goal:** a stranger from Hacker News understands, trusts and tries Compounding Loop in 30 seconds, and the first five minutes of using it work exactly as written (IDEA.md "Round 2", must-have 8 and the fresh-install test).
**Done when:**
- `npm test` passes, and `.ai/audit/docs.md` exists with no open blocker.
- **Fresh-install test**, recorded in `.ai/audit/docs.md` with the exact commands and output: `npm pack`, then install the tarball in an empty temp dir, then follow the README quick start word for word. Do it once at the start (audit) and once at the end. Send every failure in another lane's area to its outbox; fix every docs failure.
- README: lanes are in the first screen ("several unattended lanes, one repo, no merge conflicts", with this repo as the proof), `npx compounding-loop` quick start, the proof table, an honest comparison table (Claude Squad, Parallel Code, Agent Orchestrator, Vibe Kanban, Claude Code agent teams/worktrees: what each is for, and where we differ). Use only claims you can source; link the source. Add a FAQ with these questions:
  - Isn't this cron + `claude -p`?
  - What does it cost (plan usage vs API)?
  - Why not agent teams?
  - What happens when it goes wrong?
  - Is my code sent anywhere?
- `docs/lanes.md` (setup with `loop init --lanes`, ownership, outboxes, control room, `check-lanes` in CI, staggered cron, troubleshooting). `docs/getting-started.md` is updated. Plugin commands are documented. A check in `scripts/check.mjs` fails if a `loop <cmd> --flag` in README/docs does not exist in `node bin/loop.js <cmd> --help` (round 1 next-improvement #6).
- `launch/` is rewritten for the 0.2.0 story. Show HN: a title under 80 characters with no hype words, a first comment with the honest backstory and numbers. Also Reddit, X, LinkedIn and dev.to. Each draft has a "Likely objections + answers" section for the owner.
- CI runs `node bin/loop.js check-lanes --range <base>..HEAD` on PRs and pushes, once core ships it.
- `CHANGELOG.md` `[Unreleased]` lists everything in 0.2.0. The version stays 0.1.0 (the owner's Claude does the release).
**Constraints:** honest claims only, each backed by the repo, the reference data or a linked source. No posting, no publishing. The repo URL is `https://github.com/Minntooos/Compounding-Loop`. The demo is https://minntooos.github.io/Compounding-Loop/.
**Out of scope:** product code. Report product failures to the owning lane.

## Units, in order
1. **Audit** (`.ai/audit/docs.md`):
   - The fresh-install test.
   - Read the README as a skeptical HN reader (what makes them close the tab, which claim lacks proof, what's unclear in 30 seconds).
   - Check every link.
   - Check the docs against `--help`.
   - Read `launch/` for hype words and unsupported claims.
   - Check the demo link and the screenshots (are they current?).
   Fix blockers.
2. The docs-vs-help check in `scripts/check.mjs`.
3. README rework + comparison table + FAQ.
4. `docs/lanes.md` + getting started + plugin docs (follow core/kit outboxes for the real flags; write placeholders marked TODO only while waiting, and remove them before DONE).
5. CI `check-lanes` step (after core ships it). Screenshots from web (`docs/assets/screens/`) go into README/docs.
6. `launch/` rewrite with objections sections.
7. CHANGELOG, final fresh-install test, majors from the audit.

## Decisions

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns, except for the "main stays green" fix.
- Describe a feature in the README before its lane has shipped and tested it.

## Handoff
Round 2 starts here. Commits carry a `Lane: docs` trailer (CLAUDE.md).
