# HTTP API contract (server ⇄ web)

Owned by the **server** lane; change it in the same commit as any route change. **web** may append under "Requested". Base path `/api`, JSON unless noted. Types live in `src/core/types.ts`.

| Method | Path | Returns | Notes |
|---|---|---|---|
| GET | `/api/health` | `{ ok: true, version, demo: boolean }` | liveness |
| GET | `/api/loops` | `LoopSummary[]` | Fleet; sorted by attention (failing, blocked, building, waiting, done) |
| GET | `/api/loops/:id` | `LoopDetail` | summary + timeline (commits), contract (done-when items with pass/fail), knowledge, decisions |
| GET | `/api/inbox` | `InboxItem[]` | every BLOCKED.md: loop id, file, question, best guess, since |
| POST | `/api/loops/:id/answer` | `{ ok: true, commit }` | body `{ file, answer }`: writes the answer, deletes BLOCKED.md, commits, pushes. Demo: `409 { error: "demo is read-only" }` |
| GET | `/api/checks` | `HealthCheck[]` | Health page: `{ loopId, kind, ok, reason, proof }` |
| GET | `/api/events` | SSE | events: `loop-updated { id }`, `inbox-changed`, `checks-changed` |

**LoopSummary (draft; server finalises it in types.ts):** `{ id, name, url?, state: LoopState, reason, round, roundsTotal, run, runLimit, nextRunAt?, tests?: { passed, failed, at }, live?: { ok, status, leaked: string[] }, pages?, lastCommit?: { sha, at, message } }`

## Requested
(web appends: date · what · why)
