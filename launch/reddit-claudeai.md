# r/ClaudeAI draft

**Lead with the eval number (owner: fill in after the real `loop eval run`, then delete this note):** <!-- eval: pending --> "[headline from `npx compounding-loop eval report`]". Quote the report only; never invent or round up a figure. Frame: learn once, one-shot the next; the smallest context that still passes.

**Title:** I used scheduled Claude Code runs to build 5 sites unattended; 0.2.0 adds parallel lanes

The short version: briefs with checkable done-when, one unit of work per run, a reviewer subagent before every push, a session lock, a run budget, and `BLOCKED.md` when stuck. Each site finished 5 rounds with all tests passing (278–543 per site).

It cost me five briefs and a few answers to blocked questions. It also failed in instructive ways: runs starved by the usage limit, cloud clones that were stale, overlapping runs. Those failures are why the lock, budget and reviewer exist. Write-up: `launch/devto-article.md` in the repo.

0.2.0 adds lanes: several scheduled runs on one repo, each owning its own paths, with `loop check-lanes` to enforce it. The tool was built by five lanes.

Repo (MIT, no telemetry): https://github.com/Minntooos/Compounding-Loop
Demo on the real data: https://minntooos.github.io/Compounding-Loop/ (or `npx compounding-loop dashboard --demo`)
Controls: pause all lanes and start the next round from the CLI; releases to npm run from a GitHub Actions workflow with trusted publishing (no token).

Happy to answer questions about what didn't work.

## Likely objections + answers (for the owner)
- **"Isn't this cron + `claude -p`?"** Partly, yes: the scheduler is plain. What the repo adds is what stops a run: checkable done-when, a reviewer pass, a lock, a run budget, `BLOCKED.md`, and `loop check-lanes` for parallel lanes. See the FAQ in the README.
- **"What does it cost?"** Depends on your Claude plan or API use; the tool adds no cost of its own and I have no cost-per-site figure to quote. Do not invent one.
- **"Why not agent teams / worktrees?"** Those fit one interactive session. This is for scheduled runs with nobody watching, where ownership is checked per commit. The README comparison table lists sources; do not claim the others lack features beyond what it cites.
- **"What if it goes wrong?"** Runs stop at the budget or write `BLOCKED.md`; `main` is protected only by the repo's own tests. A bad round is a revert away. Say so plainly.
- **"Do the lanes really stay in their paths?"** Nearly. `loop check-lanes` on the last 50 commits of this repo flags one commit: the docs lane deleting a stray `.tmp-t.mts` another lane had left behind, a file no lane owns. Earlier rounds had real crossings (web regenerating `demo/this-repo.json`, kit editing `src/core/runPrompt.ts`); the check caught them and the CI step is now blocking. Run it yourself: `npx compounding-loop check-lanes --range origin/main~50..HEAD`.
- **"Is the sample size five sites?"** Yes, built by one person on calculator sites. It is evidence, not a benchmark.
