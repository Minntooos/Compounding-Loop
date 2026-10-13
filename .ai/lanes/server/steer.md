# Steering for the server lane

Notes from the owner or a teammate, newest first. Entry format: `## YYYY-MM-DD HH:MM UTC · <author> · next-run|standing`, then the text. The lane adds one line under each entry it has read: `→ done in run N` or `→ not done: <why>` (see `.ai/lane-run.md` steps 3 and 7). Write entries with `loop steer`, the dashboard's Steer button, or by hand.
→ not done: addressed to web, nothing for the server lane (acknowledged in run 1)

## 2026-10-13 17:16 UTC · Minntooos · next-run
Two wrong readings in local 'loop dashboard --projects .' (projects folder with compounding-loop + proj1-5) at 16:30 UTC Oct 13: (1) GET /api/loops gives compounding-loop roundLabel 'Round 6' while IDEA.md's first section is Round 5 (same off-by-one the dashboard review saw on proj2: archived done-vN files or round sections miscounted). (2) reason 'stalled: docs (no commit or lock for over 2 cron periods)' and state failing, while runOutcomes.sleeping lists docs and schedule.json has docs notBefore 2026-10-13T18:00Z: a lane that is not due, sleeping, paused or DONE must never count as stalled. Fix both with unit tests; tell web in the outbox if the card/strip needs a change.
