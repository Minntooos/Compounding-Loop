# Steer, schedule and pace a loop

*Glance, steer, sleep.* You leave a laned loop running, look at the dashboard, and change course with one typed sentence that is saved as a file in the repo. Lanes with nothing to do cost almost nothing, so the loop can stay on around the clock.

Everything here is a file in `.ai/` on `main`. The dashboard and the `loop` commands only write those files and commit them with `Lane: control`; the lanes read them at the start of their next run. There is no server, token or account in between. This page assumes a laned repo (`npx compounding-loop init --lanes core,web,docs`, see [Lanes](lanes.md)); `init --lanes` writes every file below.

## How a run finds out what to do

A routine's prompt is short on purpose. It does the `git pull` (with the stale-clone recovery) and points at the repo:

```text
Run `date -u` and note it as this run's start time. Run `git checkout main && git pull --ff-only`. ...
Then follow `.ai/lane-run.md` from step 1, exactly, with `<lane>` = `core`.
```

The exact text for every lane is [`runners/routine/lane-prompt.md`](../runners/routine/lane-prompt.md) (the control room uses [`control-room-prompt.md`](../runners/routine/control-room-prompt.md)); `loop run --lane core --dry-run` prints it with your lane filled in. Copy it into the routine once and never touch it again: how every lane runs lives in `.ai/lane-run.md`, so changing it is one commit that ends `Lane: control`, not an edit in each routine's settings. Lane runs never edit that file.

`.ai/lane-run.md` starts with cheap stop checks, before `npm install`. A lane replies and stops at once when:

| The run says | Because |
|---|---|
| "Nothing to do" | root `DONE.md` or `BLOCKED.md`, the lane's own `DONE.md` or `BLOCKED.md`, or someone else's unexpired [claim](team.md) exists. |
| "Paused" | `.ai/PAUSED` exists (`loop pause`). |
| "Not due" | the lane's entry in `.ai/schedule.json` is paused, sleeping, or has a `notBefore` in the future. |

After the checks the run reads its steering, does its units and appends a line to its run log, even when it did nothing.

## Steer a lane

```sh
npx compounding-loop steer docs "Use the new screenshots in the README before anything else"
npx compounding-loop steer web "Never add a dependency without a reason in Decisions" --standing
```

This appends an entry to `.ai/lanes/<lane>/steer.md`, wakes the lane in `schedule.json` and commits and pushes it. Options: `--standing`, `--author <name>` (default `git config user.name`), `--no-commit`, `--no-push`, `--dir`. An entry looks like this:

```markdown
## 2026-10-13 18:20 UTC · Sam · next-run
Use the new screenshots in the README before anything else.
→ done in run 3
```

- **`next-run`** (the default) is done first in the lane's next run, before its own unit order.
- **`standing`** applies to everything the lane does until you delete the entry.
- The lane adds one `→` line under each entry it has read, `→ done in run N` or `→ not done: <why>` (for instance when the note asks for something the hard rules forbid). That is the only edit a lane makes to the file, so an entry with no `→` line has not been read yet.

You can also write the entry by hand and push it. In the dashboard, press **S** or use the **Steer** button on a loop, a lane or a unit: pick the lane (and unit), choose *Next run* or *Standing*, type plain language, and the dialog shows the exact `steer.md` entry before anything is saved. Locally **Save** writes and commits it. On the hosted demo the button is **Edit on GitHub** (or **Create it with this entry**), a prefilled GitHub page you submit yourself. A lane's steer history shows each entry with whether it has been acknowledged.

## Schedule: pause, snooze, wake, sleep

`.ai/schedule.json` decides whether a lane is due:

```json
{ "version": 1, "lanes": { "docs": { "notBefore": "2026-10-13T21:00:00Z", "sleeping": false, "paused": false, "reason": "1 idle run in a row" } } }
```

A missing file, or a lane with no entry, means due.

```sh
npx compounding-loop schedule show [--json]     # each lane: due, paused, sleeping or snoozed, with idle runs
npx compounding-loop schedule pause docs --reason "waiting for the design"
npx compounding-loop schedule resume docs
npx compounding-loop schedule snooze docs 3h    # ISO time, a date, or 3h / 2d
npx compounding-loop schedule wake docs         # or: wake all
npx compounding-loop schedule update            # the idle backoff, below
```

Each action commits with `Lane: control` (`--no-commit` skips that). The dashboard has the same buttons on every lane: **Pause lane** (asks first, because it stops work) and **Resume**, **Snooze until…**, **Wake now**, with the state shown, for instance "sleeping since 14:00 · 3 idle runs". **Pause all** (`loop pause`) is separate: it writes `.ai/PAUSED`, which stops every lane and the control room.

### Idle for free

A run that did no units is *idle*. At the end of an idle run the lane (or `loop schedule update`) backs itself off:

| Trailing idle runs | Effect |
|---|---|
| 1 | `notBefore` = last run + 3 h |
| 2 in a row | `notBefore` = last run + 6 h |
| 3 or more | `sleeping: true` |

Any run with units resets the count. Skipped runs answer "Not due" in seconds, so a sleeping loop costs almost nothing. A sleeping lane wakes by itself when it gets an unacknowledged steer entry, a message addressed to it in another lane's outbox or the control room's notes that is newer than its last run, or a new round starts. A paused lane is never changed by the backoff.

## What the dashboard calls a run

The Runs tab and the lane × hour heat map classify every expected slot with the same rules as `loop runs`:

| Outcome | Meaning |
|---|---|
| Worked | the run logged units or pushed. |
| Idle | the run started and found nothing to do. |
| Not due | `schedule.json` said skip, so no run was expected. |
| Likely running | inside its 50-minute window with no log line yet. |
| Missed | due, the window passed, and no line: usually a usage-limit stop or a failed start. |
| Tests failed | the run logged a failing test result. |
| Paused / done | `.ai/PAUSED`, root `DONE.md`, or the lane is done or blocked: nothing is expected. |

A "Missed" slot after the window is the thing to look at. The run log is the source, so a run that exits early must still append its line (step 8 of `lane-run.md`).

## Pace: how much checking a run does

`.ai/policy.json` sets the pace for the loop and, optionally, for single lanes:

```json
{ "version": 1, "pace": "balanced", "lanes": { "web": { "pace": "fast" } } }
```

```sh
npx compounding-loop pace show
npx compounding-loop pace set sprint                 # whole loop
npx compounding-loop pace set fast --lane web        # one lane
```

| Pace | What a run does |
|---|---|
| `careful` | Full tests after every unit and before push; a reviewer on every unit; 40 minutes per run. |
| `balanced` (default) | Related tests after each unit, full tests before push; one reviewer per run; 40 minutes. |
| `fast` | Like balanced, but a reviewer only for shared files or another lane's contract; 50 minutes. |
| `sprint` | Typecheck and lint per unit, unit tests before push, e2e once at the end; no reviewer; 50 minutes or 70% of context. |

**The floor for every pace:** a run never pushes with a failing check it ran, and CI runs on every push. A lower pace saves usage; it does not turn verification off. **Auto-downshift:** if CI on `main` is red twice in 24 hours, the control room sets the global pace back to `balanced` and says why in `.ai/control-room.md`. An unreadable `policy.json` or an unknown preset means `balanced`.

In the dashboard, the Pace control on the loop page and on each lane shows the four presets with one line each, the current value and any lane override. Locally **Save pace** writes and commits `policy.json`; on the demo it opens GitHub's editor with the new file text.

## Start the next round

When a round is done, **Start next round** takes a brief ([Dashboard](dashboard.md#controls)). To draft one from what the round left behind:

```sh
npx compounding-loop next-round --draft                 # asks Claude (claude -p), writes .ai/next-round.draft.md, prints the score
npx compounding-loop next-round --draft --print-prompt  # only prints the prompt, to paste into Claude Code yourself
```

The prompt is built from the lanes' `DONE.md` "next 10" lists, open audit findings, unacknowledged steer entries and the out-of-scope list in `IDEA.md`. It uses your own signed-in `claude` and writes only the draft file; **Go** is always a separate, explicit step.
