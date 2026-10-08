## Lanes

This repository is built by parallel **lanes**. Lanes in this repo: {{lanes}}. Each lane is a scheduled run that owns one part of the codebase. `.ai/lanes.json` says which paths each lane owns and which files are shared; read it first. Each lane's task file is `.ai/lanes/<lane>/task.md`.

- **Edit only the paths your lane owns.** Read anything. **Shared files** (`shared` in `.ai/lanes.json`) may be edited by any lane, with the smallest possible edit.
- **Commit trailer:** every commit message ends with a line `Lane: <your lane>` (the control room uses `Lane: control`). `loop check-lanes` fails a commit that touches another lane's paths.
- **Talking to other lanes:** write only to your own `.ai/lanes/<you>/outbox.md`, newest first, `YYYY-MM-DD HH:MM UTC · to <lane|all> · message`. At the start of each run read every other lane's outbox and `.ai/control-room.md` for messages to you or `all`, and act on them or say in your task file why not.
- **Main stays green.** If the tests fail on a fresh pull before you change anything, fixing that is your first unit, whichever lane owns the failure. Make the smallest fix, commit it with the trailer `Lane: control` (the only trailer `loop check-lanes` lets touch any path), and tell the owning lane in your outbox.
- **Git:** work on `main`. Start every run with `git checkout main && git pull --ff-only`, pull again right before each push, and on a rejected push `git pull --rebase`. If a rebase conflicts in a file you do not own, `git rebase --abort`, record it under Tried, pull fresh, redo your small change on top. Never force-push.
- **Run budget:** your lane's task file holds `Run: N / LIMIT`. Add 1 at the start of every run; at the limit write `.ai/lanes/<lane>/BLOCKED.md` ("run budget reached") and stop.
- **Stop files:** if root `DONE.md` or `BLOCKED.md`, or your lane's `DONE.md` or `BLOCKED.md`, exists at the start of a run, do nothing and stop. A lane writes its own `DONE.md` when every done-when in its contract passes and the reviewer finds no blockers. Root `DONE.md` is written only by the control room.
- **Stuck:** the same failure twice means the stuck protocol; its last step is the lane's `BLOCKED.md` with what you tried, the specific question and your best guess.
- **Review before every push to `main`:** the tests must pass, then a reviewer subagent that did not write the code checks the diff against the brief ("find the three most likely ways this is wrong for a real user, and check each"). Fix blockers first.
- **Questions:** no human is watching. Decide from the brief and common sense, write the decision and the reason under **Decisions** in your task file, and pick the option that is easiest to reverse.
- **Lane finished:** read the other lanes' outboxes first; if anyone waits on you, do that before writing `DONE.md`.
- **Shared files and shared types** are add-only for other lanes: add fields, never rename or remove, and say so in your outbox.
- **Never:** spend money, sign up for anything, publish anything, add secrets, telemetry or tracking, or touch anything outside this repository.
