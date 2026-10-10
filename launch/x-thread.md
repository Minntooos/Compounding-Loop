# X thread draft

1/ I let scheduled Claude Code runs build five live sites while I wasn't watching: 215 pages, 2,125 passing tests, 464 commits. What kept it honest is below.

2/ The agent never says it's done. The task file lists done-when as commands. If `npm test` is red, the work doesn't count.

3/ A second agent that didn't write the code reviews every diff before it's pushed.

4/ Runs can't overlap (session lock), can't run forever (run budget), and write BLOCKED.md when stuck. You answer from an inbox.

5/ New in 0.2.0: lanes. Several scheduled runs, one repo, each owning its own paths. `loop check-lanes` fails any commit outside its lane. This repo was built by five lanes.

6/ Open source, MIT, no telemetry. Demo on the real data: https://minntooos.github.io/Compounding-Loop/
https://github.com/Minntooos/Compounding-Loop

## Likely objections + answers (for the owner)
- **"Isn't this cron + `claude -p`?"** Partly, yes: the scheduler is plain. What the repo adds is what stops a run: checkable done-when, a reviewer pass, a lock, a run budget, `BLOCKED.md`, and `loop check-lanes` for parallel lanes. See the FAQ in the README.
- **"What does it cost?"** Depends on your Claude plan or API use; the tool adds no cost of its own and I have no cost-per-site figure to quote. Do not invent one.
- **"Why not agent teams / worktrees?"** Those fit one interactive session. This is for scheduled runs with nobody watching, where ownership is checked per commit. The README comparison table lists sources; do not claim the others lack features beyond what it cites.
- **"What if it goes wrong?"** Runs stop at the budget or write `BLOCKED.md`; `main` is protected only by the repo's own tests. A bad round is a revert away. Say so plainly.
- **"Do the lanes really stay in their paths?"** Mostly. `loop check-lanes` on the last 50 commits reports three crossings (web regenerating `demo/this-repo.json`, kit editing `src/core/runPrompt.ts`, core leaving a stray `.tmp-t.mts`). Say so; it shows the check works, and the CI step is advisory until they are cleaned up.
- **"Is the sample size five sites?"** Yes, built by one person on calculator sites. It is evidence, not a benchmark.
