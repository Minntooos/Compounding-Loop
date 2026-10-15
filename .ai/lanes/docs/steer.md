# Steering for the docs lane

Notes from the owner or a teammate, newest first. Entry format: `## YYYY-MM-DD HH:MM UTC · <author> · next-run|standing`, then the text. The lane adds one line under each entry it has read: `→ done in run N` or `→ not done: <why>` (see `.ai/lane-run.md` steps 3 and 7). Write entries with `loop steer`, the dashboard's Steer button, or by hand.

## 2026-10-15 01:10 UTC · owner · standing
Save usage for the rest of round 6: do NOT run `npm test`, `npm run unit`, `npm run e2e`, Playwright, screenshots, axe or a reviewer subagent. Before each push run only `npm run typecheck` and `npm run build`, and fix them if they fail. CI checks every push; the owner reviews bugs and security at the end with an external tool (CodeRabbit). Done-when items that need tests, screenshots or a design review count as met by a green CI run plus a one-line note in your audit file. Keep units small and write DONE as soon as your goal ships.
