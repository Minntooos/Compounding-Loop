# Lane kit: DONE (round 3, 0.3.0 "Showcase")

## Built
- Round 3 re-audit (`.ai/audit/kit.md`), no open blocker.
- Claim rule in the routine lane prompt, the GitHub Actions lanes workflow, local runners and the lane section templates write into CLAUDE.md/AGENTS.md; tests assert it.
- "Working with teammates" in the method's lanes chapter; plugin `/loop-next` and `/loop-lanes` commands.
- Lane-aware retro and handoff wording (keeps the `units 1-3 done` phrasing `loop next` parses).
- Control-room job in `runners/github-actions/lanes.yml` (3-hourly cron), systemd timer.

## Tests
`npm test` green on a fresh pull at run 6: 120 e2e passed, 26 skipped; check, typecheck, unit, build pass.

## Unsure
- `lanes.yml` has never run on a real repository.
- Reviewer subagent skipped in run 5 (text-only change, tests assert it).

## Ten best next improvements
1. Run `lanes.yml` on a real repo and fix what the runner shows; use the full per-lane prompt file.
2. `app-with-lanes` template (needs core to exclude it from `listTemplates`).
3. Pin the `compounding-loop` version in CI snippets once 0.3.0 is released.
4. Python and Astro site templates.
5. Template CI workflow that also runs the project's own `npm test`.
6. More example knowledge entries drawn from real runs.
7. Plugin command that shows `loop status` across lanes.
8. A claim reminder in the lane prompt when the claim is about to expire.
9. Runner docs for Windows `claude.cmd` setups using `loop run`.
10. A template-level `loop check-lanes` CI step for generated repos.
