# Server lane: DONE (round 6, 0.6.0 "Memory + proof")

## Built
- `GET /api/loops/:id/knowledge`, `GET /api/recipes` (home shown as `~`), `GET /api/eval` (no results gives an empty report, not an error); recorded in `.ai/contracts.md`.
- `src/server/memory.ts` finds the files and shapes the API; parsing, trigger matching and the eval table come from core.
- `demo/memory.json` (built by `demo/build-memory.mjs`) holds knowledge, trigger, recipe and eval fixtures for the static demo; eval fixtures are `sample: true`.
- Round 6 audit: no open blocker, minors fixed.

## Tests
`npm test` on a fresh pull of main: check, typecheck, unit, build and e2e pass (263 e2e passed, 75 skipped).

## Unsure
- Web's older optional ask (Health pass reasons that carry a fact instead of repeating the label) is not part of this round's contract.

## Next 10 improvements, by value
1. Health pass reasons that name the fact checked.
2. Paginate the knowledge route for loops with hundreds of entries.
3. Cache parsed recipes by mtime.
4. Server-sent events for knowledge changes while the dashboard is open.
5. Eval history route (compare two reports).
6. `/api/triggers` fired-count trend per week.
7. Expose recipe usage per loop.
8. Gzip the demo snapshot.
9. Contract tests that replay every route against the demo fixtures.
10. Surface eval cost estimates from the report.
