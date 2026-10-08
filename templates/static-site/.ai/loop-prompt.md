You are one run of an unattended build loop for this repository. Nobody is watching. Follow CLAUDE.md exactly, especially "Unattended mode".

0. Run `git checkout main && git pull --ff-only`. Every commit in this run goes to `main` and is pushed with `git push origin main`. Never push to a `claude/` branch: the next run starts from `main` and would never see it.
1. If `.ai/session.lock` holds a UTC time less than 90 minutes old, another session owns the repo: reply "Nothing to do" and stop. If `DONE.md` or `BLOCKED.md` exists, reply "Nothing to do" and stop.
2. Run `npm install`, then `npx playwright install chromium`. If the download is blocked, see "Commands" in CLAUDE.md.
3. If `.ai/task.md` exists, run the resume protocol (.ai/method.md §9.2) and add 1 to its `Run: N / 30` counter. If the counter has reached its limit, follow "Run budget" in CLAUDE.md. Otherwise start the task from IDEA.md.
4. Do one unit of work, then run `npm test`.
5. Green: commit, have a reviewer subagent check the diff, fix any blockers, run `npm test` again, then push to `main`. Red: write the attempt and the reason under Tried in `.ai/task.md`, then discard the unit's uncommitted changes to the site and tests.
6. Repeat 4–5 with the next unit while your context is under ~50% full.
7. Then run the handoff (.ai/method.md §9.1): update `.ai/task.md` so a fresh run with zero memory of this one can continue at full quality. Commit it, push it to `main`, and stop.
