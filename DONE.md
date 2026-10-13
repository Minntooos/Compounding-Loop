# DONE: Round 5, 0.5.0 "Cockpit"

Written by the control room on 2026-10-13 21:40 UTC. All five lanes (core, kit, server, web, docs) have a DONE.md.

## What was built
- core: schedule/steer parsers, `loop schedule`, `loop steer`, `loop pace`, run-outcome classification, `next-round --brief/--draft`, brief lint for round briefs (this brief scores 100).
- kit: templates with skip, steer, run-log and stale-clone steps.
- server: routes, demo fixtures, URL builder, lane health.
- web: status strip, Needs-you, heat map, steer composer, schedule and Pace controls, Releases.
- docs: README, `docs/steering.md`, fleet screenshots.

## Test results (control room, fresh run on origin main 576c1c4)
- `npm test` green: check, typecheck, unit, build, e2e (263 passed, 75 skipped by project).
- JS bundle 157 kB gzip (limit 300 kB).
- `npm pack`: no `.ai/`, IDEA.md, CLAUDE.md, tests or reference data; secret and email grep clean.
- Fresh-install: tarball installs, `loop --version` prints 0.4.0 (version unchanged by design).
- `loop check-lanes`: one known crossing, 1f27d58 (server touched core files; an owner steer, main green).

## Open / unsure
- Core's audit table still listed R5-2..R5-5 as open although shipped; marked FIXED after verification.
- The full README quick start and `loop init --lanes` were only spot-checked (init writes files and commits in a temp repo); the owner may re-run `docs/steering.md` once.
- Minor items from `.ai/audit/*.md` and each lane's DONE.md "next improvements" remain.

## Owner's release checklist
1. Local Claude Code bumps the version to 0.5.0, finalises CHANGELOG, runs `npm test`.
2. After the owner approves, publish.
3. Then post the drafts in `launch/`.
