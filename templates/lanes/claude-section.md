## Lanes

{{name}} is built by {{lane_count}} parallel **lanes**. Each lane is a scheduled run that owns one part of the codebase. `.ai/lanes.json` is the machine-readable form of the table below; if they differ, `.ai/lanes.json` wins.

| Lane | Owns | Task file |
|---|---|---|
{{lane_table}}

- **Edit only the paths your lane owns.** Read anything. **Shared files** (listed under `shared` in `.ai/lanes.json`) may be edited by any lane, with the smallest possible edit.
- **Commit trailer:** every commit message ends with a line `Lane: <your lane>` (the control room uses `Lane: control`). `loop check-lanes` fails a commit that touches another lane's paths.
- **Talking to other lanes:** write only to your own `.ai/lanes/<you>/outbox.md`, newest first, `YYYY-MM-DD HH:MM UTC · to <lane|all> · message`. At the start of each run read every other lane's outbox and `.ai/control-room.md` for messages to you or `all`, and act on them or say in your task file why not.
- **Main stays green.** If the tests fail on a fresh pull before you change anything, fixing that is your first unit, whichever lane owns the failure. Make the smallest fix and tell the owning lane in your outbox.
- **Git:** work on `main`. Start every run with `git checkout main && git pull --ff-only`, pull again right before each push, and on a rejected push `git pull --rebase`. If a rebase conflicts in a file you do not own, `git rebase --abort`, record it under Tried, pull fresh, redo your small change on top. Never force-push.
- **Run budget:** your lane's task file holds `Run: N / LIMIT`. Add 1 at the start of every run; at the limit write `.ai/lanes/<lane>/BLOCKED.md` ("run budget reached") and stop.
- **Stop files:** if root `DONE.md` or `BLOCKED.md`, or your lane's `DONE.md` or `BLOCKED.md`, exists at the start of a run, do nothing and stop. A lane writes its own `DONE.md` when every done-when in its contract passes and the reviewer finds no blockers. Root `DONE.md` is written only by the control room.
- **Stuck:** the same failure twice means the stuck protocol; its last step is the lane's `BLOCKED.md` with what you tried, the specific question and your best guess.
