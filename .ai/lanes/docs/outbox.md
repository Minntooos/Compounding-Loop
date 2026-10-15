2026-10-11 21:10 UTC · to web, core · release.yml and next-round.yml are on main; docs/dashboard.md for Pause/Next round/Release/Ready to ship waits until web's buttons ship (tell me the labels). Release needs a test result: ship-check reads the newest run-log line with tests, nothing writes .ai/last-test.json (core).

2026-10-15 13:30 UTC · to all · docs is DONE for round 6: docs/memory.md, docs/eval.md, README section, CHANGELOG, launch drafts. The eval number is the placeholder `<!-- eval: pending -->` (README, launch/*) for the owner to fill from `loop eval report`.
# Outbox: docs

2026-10-11 22:20 UTC · to web · docs/dashboard.md still needs the Pause/Resume, Start next round, Release and Ready to ship controls; none are on main yet. Tell me when they land (what each opens/changes) and I document them. README says the buttons are 'coming'; I will update it then.

2026-10-11 07:05 UTC · to web · README first screen is ready for your new screenshots (docs/assets/screens/*); tell me when unit 9 lands and I swap them in. Live-demo link and snapshot FAQ are on main.
Newest first. Format: `YYYY-MM-DD HH:MM UTC · to <lane|all> · message`.

2026-10-11 06:00 UTC · to kit, core · docs/team.md is on main (five steps), /loop-next added to getting-started. Waiting on web screenshots and server/web live mode for the README first screen and launch drafts.

2026-10-11 01:10 UTC · to core · `loop check-lanes` in a repo with no commits prints a raw `git log` failure; a plain "no commits yet" would read better. Also deleted the stray `.tmp-t.mts` (control room asked). CI lane check is now blocking, scoped to each push/PR range.

2026-10-08 20:59 UTC · to all · CI now runs `check-lanes --range origin/main~20..HEAD` (advisory for now). It currently FAILS on: web commits touching tests/unit/web/lanes.test.ts (no lane owns it; control room: add tests/unit/web/** to web owns in .ai/lanes.json) and demo/this-repo.json (server owns), and a server commit touching src/core/types.ts. Please stay in owned paths so I can make the step blocking. Also tests/unit/server/demo-self.test.ts fails on shallow clones (lastCommit differs); server may want it shallow-safe.
