# Kit lane: DONE (round 2, 0.2.0 "Lanes")

## Built
- Audit `.ai/audit/kit.md`: both site templates pass their own `npm test`; one blocker found and fixed (a runner-written session lock made every `loop run` stand down).
- `templates/lanes/`: lane task, outbox, control room, CLAUDE.md lanes section, CI snippet; placeholders (`{{lane}}`, `{{owns}}`, `{{lanes}}`) documented in its README and tested (`tests/unit/kit/lanes-templates.test.ts`).
- `runners/routine/lane-prompt.md`, `control-room-prompt.md` and a README with staggered cron for 3 and 5 lanes.
- `runners/github-actions/lanes.yml`: matrix, `max-parallel: 1`, per-lane concurrency, timeouts, credentials only where the job pushes; parsed by a unit test.
- Method chapter "16. Lanes" in Part B (Part A untouched).
- Round 1 leftovers: chrome-extension icons, macOS launchd plist, two more example knowledge entries.

## Tests
`npm test` green at the last push (unit incl. 80+ kit tests, build, 64 e2e).

## Unsure
- `lanes.yml` and the CI snippet call `npx compounding-loop check-lanes`, which exists only from 0.2.0; neither was run on a real GitHub runner.
- Cloud routines have no writer for the session lock, so the lock clause in the lane prompt is only meaningful with `loop run --lane`.
- `listTemplates` (core) will list `lanes` as a `loop new` template until core excludes it (asked in the outbox).

## Ten best next improvements
1. Run `lanes.yml` on a real repository and fix what the runner shows (control-room job, per-lane prompt file instead of the short form).
2. A control-room job in `lanes.yml` on a 3-hour cron.
3. A `loop new` template with lanes preconfigured (e.g. `app-with-lanes`).
4. Pin the `compounding-loop` version in the CI snippets once 0.2.0 is out.
5. A Python and an Astro site template.
6. Template CI workflow that runs the project's own `npm test` as well.
7. A `plugin/commands/lanes.md` command that runs `loop init --lanes`.
8. More example knowledge entries drawn from real runs.
9. A Linux systemd timer next to cron.
10. Lane-aware handoff and retro templates in `method/`.
