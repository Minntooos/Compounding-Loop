# Control room run procedure

The control room routine's prompt says "follow `.ai/control-run.md`". The prompt itself does step 0 (pull, stale clone). You do the supervision the owner would otherwise do by hand. Be brief and cheap. Read CLAUDE.md (lane table, hard rules, Unattended mode) and IDEA.md (its first section is the current round, with the "done when" list and the deadline). Every commit you make ends with the trailer line `Lane: control`.

1. If root `DONE.md` exists, give the summary (step 7) and stop. If `.ai/PAUSED` exists, reply "Paused" and stop.
2. **Schedule** (cheap, before `npm install`). Read `.ai/schedule.json`, each lane's `runs.jsonl`, `steer.md`, outbox and `.ai/control-room.md`.
   - Run `node bin/loop.js schedule update` once core ships it. Until then, apply IDEA.md Round 5 B1 by hand:
     - backoff for idle lanes;
     - **wake** a lane that is sleeping or waiting on `notBefore` (`sleeping: false`, `notBefore: null`) when it has a steer entry with no `→` line, or a message addressed to it newer than its last run.
   - Never change `paused` (only the owner pauses a lane).
   - If nothing else in this run needs work, commit any schedule change and skip to step 7. "Nothing else" means: no lane committed since your last run, and no lane has DONE.md that hasn't been checked yet.
3. Run `npm install`, `npx playwright install chromium` (fallbacks in CLAUDE.md "Commands"), then `npm test`.
   - If it is red, find the commit that broke it (`git log`, `git bisect` only if quick).
   - If the fix is small and obvious, make it, run `npm test`, commit and push.
   - Otherwise add a note to `.ai/control-room.md` addressed to the owning lane, with the failing command and the likely commit.
4. **Leak check:**
   - `npm pack --dry-run` must list nothing from `.ai/`, `IDEA.md`, `CLAUDE.md`, `tests/` or reference data, and `npm run check` must pass.
   - Grep the repo for secrets (API keys, tokens, private keys) and for the owner's email address. Fix any leak immediately (smallest change), push, and say so in the summary.
   - Run `node bin/loop.js check-lanes` over the commits since your last run and tell each lane that crossed its paths in `.ai/control-room.md`.
5. For each lane, read `.ai/lanes/<lane>/task.md` (run counter, handoff), its outbox, `.ai/audit/<lane>.md` (open blockers in the current round's section), and whether `.ai/lanes/<lane>/DONE.md`, `BLOCKED.md` or an unexpired `claim` exists. Then:
   - **BLOCKED with "run budget reached":** if the lane made real progress (commits that pushed tests or features) and its task file has no line "Budget extended by control room", raise the limit by 15, add that line with the date under Decisions, `git rm` the BLOCKED.md, commit, push. If it was already extended once, leave it for the owner.
   - **BLOCKED with a question:** if it can be answered safely from IDEA.md and CLAUDE.md (never anything that spends money, creates accounts, publishes, posts, changes repo visibility or settings, or adds secrets), write the answer under Decisions in that lane's task file as "Answer from control room (date): ...", `git rm` the BLOCKED.md, commit, push. Otherwise leave it and put the question in your summary for the owner.
   - **A message waiting in an outbox:** if it has waited more than 3 hours for a lane that has since run without answering, copy it into `.ai/control-room.md` addressed to that lane, and wake that lane. If the lane it waits on has DONE.md, tell the waiting lane to stop waiting and either work around it or list it as a next improvement.
   - **Stalled lanes:** a lane that is due in schedule.json, has no runs.jsonl line in the last 4 hours, no DONE/BLOCKED and no unexpired claim is "stalled" in the summary (likely the plan's five-hour usage limit). A lane that isn't due is "sleeping" or "not due until <time>", not stalled. A lane with an unexpired claim is "claimed by <name>".
   - **After the deadline** of the current round in IDEA.md: tell every lane without DONE.md, once, in `.ai/control-room.md`, to finish its open unit, start nothing new and write DONE.md. Wake those lanes.
   - **Pace downshift:** if CI on `main` failed on two different commits in the last 24 h and `.ai/policy.json` is faster than `balanced` (globally or for the lane at fault), set it to `balanced`, add a note to `.ai/control-room.md` saying why, and commit with `Lane: control`. Never raise the pace yourself.
6. **Round check:** when all five `.ai/lanes/*/DONE.md` exist, check every line of the current round's "done when" list in IDEA.md by running its commands. That includes the fresh-install test: npm pack, install the tarball in an empty temp dir, and follow the README quick start and any doc the list names, word for word.
   - If all pass, write root `DONE.md`, then commit and push. It contains:
     - what was built and the test results;
     - the minor audit findings left open (from `.ai/audit/*.md`) and anything unsure;
     - the owner's release checklist: the owner's local Claude Code bumps the version, finalises CHANGELOG, runs `npm test` and publishes after the owner approves; then the owner posts the drafts in `launch/`.
   - If a line fails, add a note to `.ai/control-room.md` for the owning lane, `git rm` that lane's DONE.md so it resumes, wake that lane, commit and push.
7. Commit only `.ai/` notes, `.ai/schedule.json` and the smallest fixes. End with:
   - one line per lane: `lane · Run N/LIMIT · building|sleeping|not due until T|blocked|done|stalled|claimed · last run · open blockers · note`;
   - one line for tests and the leak check;
   - any question for the owner.

Never spend money, sign up for anything, create accounts, publish anything (no npm publish, no posting, no repo visibility or settings changes, no releases, no tags, no version bump), add API keys, secrets, ads, analytics or tracking, force-push, or touch anything outside this repository.
