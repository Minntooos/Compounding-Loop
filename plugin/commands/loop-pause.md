---
description: Pause or resume every scheduled lane run and the control room, so routines can stay enabled
---

Stop or restart the unattended runs of this repository without touching any scheduler.

1. Check the current state: `npx compounding-loop status`. If `.ai/PAUSED` exists it says who paused the loop and since when.
2. To pause, run `npx compounding-loop pause --reason "<why, one line>"`. It writes `.ai/PAUSED` and commits it with the trailer `Lane: control`. Every lane and the control room reply "Paused" and stop on their next run.
3. To resume, run `npx compounding-loop resume`. It removes `.ai/PAUSED` and commits that.
4. Tell the user in one line what changed and that the schedules themselves were not touched. If a push is refused, say so and leave the local commit in place.
