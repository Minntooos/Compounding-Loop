# Show HN draft

**Lead with the eval number (owner: fill in after the real `loop eval run`, then delete this note):** <!-- eval: pending --> "[headline from `npx compounding-loop eval report`]". Quote the report only; never invent or round up a figure. Frame: learn once, one-shot the next; the smallest context that still passes.

**Title:** Show HN: Compounding Loop – parallel unattended Claude Code lanes, one repo

Note for the owner: publish `compounding-loop` 0.5.0 to npm before posting, or the `npx` command will fail.

**First comment:**

The demo link shows this repo building itself: five lanes pushing to one `main`, read live from GitHub in your browser (it falls back to a snapshot if GitHub's 60 requests/hour limit is hit). https://minntooos.github.io/Compounding-Loop/

I let scheduled Claude Code runs build five calculator sites with nobody watching: 215 pages, 2,125 passing tests, 464 commits, roughly 18–22 hours of wall-clock time each (data in `demo/five-sites.json`). I wrote five briefs and answered a few questions.

The part that mattered was what stops the loop, not the loop. "Done" is a command, not the model's opinion. A reviewer subagent that did not write the code checks each diff before it is pushed. A session lock stops overlapping runs, a run budget caps them, and a stuck run writes `BLOCKED.md` instead of guessing.

0.2.0 adds lanes: several scheduled runs on one repo, each owning a set of paths in `.ai/lanes.json`, with `loop check-lanes` failing any commit that touches someone else's files. This repo was built that way, with five lanes (core, kit, server, web, docs) pushing to one `main`.

0.5.0 is about steering and idling: `loop steer docs "..."` saves a one-sentence note as a file in the repo that the lane reads on its next run and acknowledges, and lanes with nothing to do back off (3 h, 6 h, then asleep until there is steering or a new round), so a skipped run costs seconds. Routine prompts are two lines that point at `.ai/lane-run.md`, so changing how every lane runs is one commit.

It is a CLI, templates, runners (routine, GitHub Actions, cron), a Claude Code plugin and a local dashboard. No telemetry, loopback-only server, MIT.

Demo on real data: https://minntooos.github.io/Compounding-Loop/ (or `npx compounding-loop dashboard --demo`)
Controls: pause all lanes and start the next round from the CLI; releases to npm run from a GitHub Actions workflow with trusted publishing (no token).
Repo: https://github.com/Minntooos/Compounding-Loop

Where it is weak: five sites by one person is a small sample, and lanes are young. I would like to hear where the method breaks for you.

## Likely objections + answers (for the owner)
- **"Isn't this cron + `claude -p`?"** Partly, yes: the scheduler is plain. What the repo adds is what stops a run: checkable done-when, a reviewer pass, a lock, a run budget, `BLOCKED.md`, and `loop check-lanes` for parallel lanes. See the FAQ in the README.
- **"What does it cost?"** Depends on your Claude plan or API use; the tool adds no cost of its own and I have no cost-per-site figure to quote. Do not invent one.
- **"Why not agent teams / worktrees?"** Those fit one interactive session. This is for scheduled runs with nobody watching, where ownership is checked per commit. The README comparison table lists sources; do not claim the others lack features beyond what it cites.
- **"What if it goes wrong?"** Runs stop at the budget or write `BLOCKED.md`; `main` is protected only by the repo's own tests. A bad round is a revert away. Say so plainly.
- **"Do the lanes really stay in their paths?"** Nearly. `loop check-lanes` on the last 50 commits of this repo flags one commit: the docs lane deleting a stray `.tmp-t.mts` another lane had left behind, a file no lane owns. Earlier rounds had real crossings (web regenerating `demo/this-repo.json`, kit editing `src/core/runPrompt.ts`); the check caught them and the CI step is now blocking. Run it yourself: `npx compounding-loop check-lanes --range origin/main~50..HEAD`.
- **"Is the sample size five sites?"** Yes, built by one person on calculator sites. It is evidence, not a benchmark.
