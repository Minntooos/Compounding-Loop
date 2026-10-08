# Web lane: DONE

## What was built
Dashboard in `web/`: app shell (hash router, nav, theme toggle, Ctrl/⌘K palette), Fleet ("Needs you" bar, attention-sorted cards), Loop detail tabs (Timeline, Contract, Knowledge, Decisions, Settings), Inbox (j/k/a, Accept guess / write answer), Health, First run, Settings, New-loop wizard with live brief linter, logo/favicon, loading/error/retry states, phone layout (no horizontal scroll), both themes with AA contrast checks.

## Test results
`npm test` on 2026-10-08: check, typecheck, unit, build green; e2e 38 passed, 2 skipped (laptop + phone projects).

## Unsure / known gaps
- Settings does not show projects folder, `gh` account or default runner: server lane finished without `GET /api/settings` (requested in `.ai/contracts.md`).
- Motion on change (card flash on update) is not shipped: two e2e attempts could not force a refetch (see Tried in task.md).

## 10 best next improvements
1. Wire `GET /api/settings` into Settings (projects folder, gh account, default runner) with an e2e.
2. Motion on change for Fleet cards, tested via jsdom + @testing-library/react or a real SSE server.
3. E2E for the busy "Retrying…" state.
4. Editable Settings (default runner, theme sync) via POST.
5. Fleet filters and search by status.
6. Timeline charts of tests/round over runs.
7. Inbox bulk accept for matching guesses.
8. Wizard: create the loop through the API outside demo and show progress.
9. Toasts for SSE events (loop failed, question arrived).
10. Visual regression screenshots per screen and theme.
