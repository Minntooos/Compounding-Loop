# Lane run procedure

Every lane routine's prompt names its lane `<lane>` and says "follow `.ai/lane-run.md`". The prompt itself does step 0 (pull, stale clone). This file is the rest. Change it with a commit that ends `Lane: control`; lane runs never edit it. Wherever the Operating Card or `.ai/method.md` says `.ai/task.md`, use `.ai/lanes/<lane>/task.md`. Every commit message you write ends with the trailer line `Lane: <lane>`.

1. **Cheap stop checks. Do these before anything else, with no `npm install`.** Reply with the word in quotes and stop, without committing:
   - root `DONE.md` or `BLOCKED.md`, or `.ai/lanes/<lane>/DONE.md` or `BLOCKED.md` exists → "Nothing to do";
   - `.ai/PAUSED` exists → "Paused";
   - `.ai/lanes/<lane>/claim` names someone else and its expiry is in the future → "Nothing to do";
   - in `.ai/schedule.json`, your lane's entry has `paused: true`, `sleeping: true`, or a `notBefore` later than now → "Not due". A missing file or a missing entry means due.
2. Run the install command from CLAUDE.md (`npm install` unless it says otherwise), and install the browser the way CLAUDE.md says if the tests need one. If the install fails, write `.ai/lanes/<lane>/BLOCKED.md` with the error and stop.
3. Read `.ai/control-room.md` and every other lane's `.ai/lanes/*/outbox.md` for messages to `<lane>` or all. Read `.ai/lanes/<lane>/steer.md` (if it exists): the entries with no `→` line under them are this run's steering. `next-run` entries are done before anything else in step 4. `standing` entries apply to everything you do until the owner removes them. Run the resume protocol (.ai/method.md section 9.2) on your task file and add 1 to its run counter. If the counter has reached its limit, follow "Run budget" in CLAUDE.md.
4. Run the test command from CLAUDE.md (`npm test` unless it says otherwise) on the fresh pull. If it fails, fixing it is your first unit ("main stays green" in CLAUDE.md). Otherwise take the next unit in this order:
   1. an unacknowledged `next-run` steer entry;
   2. a message addressed to you that another lane is waiting on;
   3. the next item in your task file's units list.

   A steer entry that conflicts with IDEA.md's hard rules or "Never" list is not done: acknowledge it with the reason. Edit only the paths your lane owns, plus the smallest needed edits to shared files. Then run the tests.
5. Green: commit, have a reviewer subagent check the diff against IDEA.md, your lane contract and any steer entry it answers. Fix any blockers, run the tests again, pull, then push to `main`. Run the reviewer in the foreground if you can. If it runs in the background you are resumed when it reports; then finish this step and continue with step 6. Ending your turn ends the run unless a subagent is still running, so never end it to wait for anything else. Red: write the attempt and the reason under Tried in your task file, then discard the unit's uncommitted changes.
6. A pushed unit does not end the run. Go straight back to step 4 with the next unit. Keep going until one of these is true:
   - 40 minutes have passed since the start time (check `date -u` after each push);
   - your context is about 60% full;
   - your lane has no units left;
   - every remaining unit is blocked.

   This replaces the "when a unit is done" handoff trigger in .ai/method.md. Each unit still gets its own tests, review and push.
7. Acknowledge every steer entry you read in step 3, by adding exactly one line directly under it: `→ done in run N` or `→ not done: <why>`. Do this for a `standing` entry only once, the first time you read it. This is the only edit you make to `steer.md`. Then run the handoff (.ai/method.md section 9.1) in your task file, so that a fresh run with zero memory can continue at full quality. Add a line to your outbox for any lane affected by what you shipped (new types, routes, files they are waiting for). If every done-when in your lane contract passes, follow "Lane finished" in CLAUDE.md.
8. **Always, even when the run did nothing**, do two things before the last commit:
   - Append one line to `.ai/lanes/<lane>/runs.jsonl`. Use `npx compounding-loop runs log --lane <lane> --units <names> --passed N --failed N --pushed|--no-pushed [--note …]`, or write this JSON shape by hand: `{"at":ISO,"lane":"<lane>","units":[…],"tests":{"passed":N,"failed":N},"pushed":bool,"note":"…"}`.
   - If this run shipped no unit, apply the idle backoff to **your own entry only** in `.ai/schedule.json`. Use `npx compounding-loop schedule update` if your installed version has it. Otherwise apply the rule by hand: count your trailing idle runs in runs.jsonl. With 1, set `notBefore` to now + 3 h. With 2, set it to now + 6 h. With 3 or more, set `sleeping: true`. Set `reason` to a few words. If your lane's DONE.md now exists, leave schedule.json alone.

   Then commit, push to `main`, and stop.

Never spend money, sign up for anything, create accounts, publish anything (no npm publish, no posting, no repo visibility or settings changes, no releases, no tags, no version bump, no `release.yml` dispatch), add API keys, secrets, ads, analytics or tracking, copy other projects' content without a compatible licence, force-push, edit `.ai/lane-run.md` or `.ai/control-run.md`, or touch anything outside this repository.
