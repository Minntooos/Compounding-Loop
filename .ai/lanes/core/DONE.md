# Core lane: DONE

## Built
`src/core` (repo readers, brief linter, init, rounds, blocked, runPrompt, table) and the `loop` CLI (`init`, `new`, `next-round`, `status`, `answer`, `run`, `dashboard`).

## Test results
`npm test` green on 2026-10-08 (check, typecheck, unit, build, e2e). The slow test
`LOOP_SLOW=1 npx vitest run tests/unit/cli/new.test.ts` also passes: a repo from `loop new static-site --dry-run` passes its own `npm test`.

## Unsure / known gaps (reviewer found these; all are recorded decisions)
- `loop new` skips the brief gate and the @clack walkthrough (brief is written afterwards via the dashboard wizard or by hand).
- `loop init` installs method files, card and task files but not a check script or runner config.
- `loop run` reads `.ai/session.lock` but never writes it; `loop answer` commits without pushing.

## 10 best next improvements
1. @clack brief walkthrough + 60-point gate inside `loop new`.
2. `loop init` installs the kit's check script and runner config.
3. `loop run` writes and clears `.ai/session.lock`.
4. `loop answer --push`.
5. Write `.ai/last-test.json` after the round's npm test (server health reads it).
6. `loop status` flags the same "no commit or lock for 2 hours" Failing rule as the server.
7. Fix the stray leading dot in the status column for idle loops.
8. Keep the folder on `gh` failure with a resume flag instead of deleting it.
9. `loop doctor` to check node, git, gh and claude availability.
10. Windows path and quoting tests for the CLI.
