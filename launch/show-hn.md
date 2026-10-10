# Show HN draft

**Title:** Show HN: Compounding Loop – parallel unattended Claude Code lanes, one repo

Note for the owner: publish `compounding-loop` 0.2.0 to npm before posting, or the `npx` command will fail.

**First comment:**

I let scheduled Claude Code runs build five calculator sites with nobody watching: 215 pages, 2,125 passing tests, 464 commits, roughly 18–22 hours of wall-clock time each (data in `demo/five-sites.json`). I wrote five briefs and answered a few questions.

The part that mattered was what stops the loop, not the loop. "Done" is a command, not the model's opinion. A reviewer subagent that did not write the code checks each diff before it is pushed. A session lock stops overlapping runs, a run budget caps them, and a stuck run writes `BLOCKED.md` instead of guessing.

0.2.0 adds lanes: several scheduled runs on one repo, each owning a set of paths in `.ai/lanes.json`, with `loop check-lanes` failing any commit that touches someone else's files. This repo was built that way, with five lanes (core, kit, server, web, docs) pushing to one `main`.

It is a CLI, templates, runners (routine, GitHub Actions, cron), a Claude Code plugin and a local dashboard. No telemetry, loopback-only server, MIT.

Demo on real data: https://minntooos.github.io/Compounding-Loop/ (or `npx compounding-loop dashboard --demo`)
Repo: https://github.com/Minntooos/Compounding-Loop

Where it is weak: five sites by one person is a small sample, and lanes are young. I would like to hear where the method breaks for you.

## Likely objections + answers (for the owner)
- **"Isn't this cron + `claude -p`?"** Partly, yes: the scheduler is plain. What the repo adds is what stops a run: checkable done-when, a reviewer pass, a lock, a run budget, `BLOCKED.md`, and `loop check-lanes` for parallel lanes. See the FAQ in the README.
- **"What does it cost?"** Depends on your Claude plan or API use; the tool adds no cost of its own and I have no cost-per-site figure to quote. Do not invent one.
- **"Why not agent teams / worktrees?"** Those fit one interactive session. This is for scheduled runs with nobody watching, where ownership is checked per commit. The README comparison table lists sources; do not claim the others lack features beyond what it cites.
- **"What if it goes wrong?"** Runs stop at the budget or write `BLOCKED.md`; `main` is protected only by the repo's own tests. A bad round is a revert away. Say so plainly.
- **"Do the lanes really stay in their paths?"** Mostly. `loop check-lanes` on the last 50 commits reports three crossings (web regenerating `demo/this-repo.json`, kit editing `src/core/runPrompt.ts`, core leaving a stray `.tmp-t.mts`). Say so; it shows the check works, and the CI step is advisory until they are cleaned up.
- **"Is the sample size five sites?"** Yes, built by one person on calculator sites. It is evidence, not a benchmark.
