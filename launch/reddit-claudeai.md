# r/ClaudeAI draft

**Title:** I used scheduled Claude Code runs to build 5 sites (215 pages) unattended. Here's the method, now open source.

The short version: briefs with checkable done-when, one unit of work per run, a reviewer subagent before every push, a session lock, a run budget, and `BLOCKED.md` when stuck. Each site finished 5 rounds with all tests passing (278–543 per site).

It cost me five briefs and a few answers to blocked questions. It also failed in instructive ways: runs starved by the usage limit, cloud clones that were stale, overlapping runs. Those failures are why the lock, budget and reviewer exist. Write-up: `launch/devto-article.md` in the repo.

Repo (MIT, no telemetry): https://github.com/Minntooos/compounding-loop
Demo on the real data: https://minntooos.github.io/Compounding-Loop/ (or `npx compounding-loop dashboard --demo`)

Happy to answer questions about what didn't work.
