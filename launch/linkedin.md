# LinkedIn draft

I let scheduled Claude Code runs build five live websites while I did other things: 215 pages, 2,125 passing tests, 464 commits.

The lesson was that unattended work needs a referee. The agent can't declare itself done; the tests do. A second agent reviews every change. Runs can't overlap or exceed a budget, and they ask for help in a file when stuck.

Version 0.2.0 adds lanes: several scheduled runs on one repository, each owning its own files, with a check that fails any commit outside its lane. The tool itself was built that way.

Open source, MIT, no telemetry: https://github.com/Minntooos/Compounding-Loop

## Likely objections + answers (for the owner)
- **"Isn't this cron + `claude -p`?"** Partly, yes: the scheduler is plain. What the repo adds is what stops a run: checkable done-when, a reviewer pass, a lock, a run budget, `BLOCKED.md`, and `loop check-lanes` for parallel lanes. See the FAQ in the README.
- **"What does it cost?"** Depends on your Claude plan or API use; the tool adds no cost of its own and I have no cost-per-site figure to quote. Do not invent one.
- **"Why not agent teams / worktrees?"** Those fit one interactive session. This is for scheduled runs with nobody watching, where ownership is checked per commit. The README comparison table lists sources; do not claim the others lack features beyond what it cites.
- **"What if it goes wrong?"** Runs stop at the budget or write `BLOCKED.md`; `main` is protected only by the repo's own tests. A bad round is a revert away. Say so plainly.
- **"Do the lanes really stay in their paths?"** Mostly. `loop check-lanes` on the last 50 commits reports three crossings (web regenerating `demo/this-repo.json`, kit editing `src/core/runPrompt.ts`, core leaving a stray `.tmp-t.mts`). Say so; it shows the check works, and the CI step is advisory until they are cleaned up.
- **"Is the sample size five sites?"** Yes, built by one person on calculator sites. It is evidence, not a benchmark.
