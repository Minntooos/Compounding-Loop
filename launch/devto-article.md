# What I learned letting Claude Code build 215 pages unattended

*Draft. Numbers are from `demo/five-sites.json`; verify any new claim before publishing.*

I wrote five briefs, scheduled Claude Code to run against each, and went away. Roughly 18–22 hours later (first to last commit) there were five live sites with 215 pages, 2,125 passing tests and 464 commits. This is what I learned, mostly from what went wrong.

## 1. Rate-limit starvation
Scheduled runs share a usage window. When several loops fire together, the later ones hit the limit and end in seconds having done nothing. The fix was spacing schedules and a health check that flags runs that finish too fast.

## 2. Stale sandbox clones
A cloud run works on a clone made when it starts. Another run pushing in the meantime made pushes fail, and a stale local view made `main` look healthier than it was. Rule: pull before you start, pull again right before you push, and rebase on rejection.

## 3. The session lock
Two runs working in one repo produce conflicting edits and duplicated work. A lock file with a timestamp lets a run say "someone else is here" and stop; a lock older than 90 minutes is treated as stale so a crash can't wedge the loop.

## 4. The reviewer gate
Passing tests aren't enough: the agent that wrote the code is the worst reviewer of it. A fresh subagent that asks "what are the three most likely ways this is wrong for a real user?" caught problems the tests didn't.

## 5. Checks decide, not the model
Done-when written as commands removed all arguments about whether something was finished.

## 6. Lanes
One scheduled run per repo is slow. Five runs on one `main` collide unless each owns its own files. `.ai/lanes.json` assigns paths, each commit carries a `Lane:` trailer, and `loop check-lanes` fails any commit outside its lane. Outboxes are the only way lanes talk to each other. See docs/lanes.md.

## What I would do differently
*(Owner: add your own notes here before publishing.)*

The method and tooling are open source: https://github.com/Minntooos/Compounding-Loop

## Likely objections + answers (for the owner)
- **"Isn't this cron + `claude -p`?"** Partly, yes: the scheduler is plain. What the repo adds is what stops a run: checkable done-when, a reviewer pass, a lock, a run budget, `BLOCKED.md`, and `loop check-lanes` for parallel lanes. See the FAQ in the README.
- **"What does it cost?"** Depends on your Claude plan or API use; the tool adds no cost of its own and I have no cost-per-site figure to quote. Do not invent one.
- **"Why not agent teams / worktrees?"** Those fit one interactive session. This is for scheduled runs with nobody watching, where ownership is checked per commit. The README comparison table lists sources; do not claim the others lack features beyond what it cites.
- **"What if it goes wrong?"** Runs stop at the budget or write `BLOCKED.md`; `main` is protected only by the repo's own tests. A bad round is a revert away. Say so plainly.
- **"Do the lanes really stay in their paths?"** Mostly. `loop check-lanes` on the last 50 commits reports three crossings (web regenerating `demo/this-repo.json`, kit editing `src/core/runPrompt.ts`, core leaving a stray `.tmp-t.mts`). Say so; it shows the check works, and the CI step is advisory until they are cleaned up.
- **"Is the sample size five sites?"** Yes, built by one person on calculator sites. It is evidence, not a benchmark.
