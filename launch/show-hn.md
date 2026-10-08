# Show HN draft

**Title:** Show HN: Compounding Loop – unattended Claude Code build loops that must pass their own tests

Note for the owner: the package is not yet published, so publish `compounding-loop` to npm before posting, or the `npx` command will fail.

I let Claude Code build five calculator sites on a schedule, with nobody watching: 215 pages, 2,125 passing tests, 464 commits over roughly 18–22 hours of wall-clock time (data in `demo/five-sites.json`). I wrote five briefs and answered a few questions.

What made it work was not the loop, it was what stops the loop. Each repo has a task contract whose "done" is a command, not the model's opinion. A reviewer subagent that did not write the code attacks every diff before it is pushed. A session lock stops overlapping runs, a run budget caps spending, and when it is stuck it writes `BLOCKED.md` instead of guessing.

Compounding Loop packages that as a CLI (`init`, `new`, `run`, `status`, `dashboard`), templates, runners (routine, GitHub Actions, cron) and a local dashboard with an inbox for the questions the loop asks. No telemetry, loopback-only server, MIT.

Try the dashboard on the real data: `npx compounding-loop dashboard --demo`

Repo: https://github.com/Minntooos/compounding-loop

Happy to hear where the method breaks for you.
