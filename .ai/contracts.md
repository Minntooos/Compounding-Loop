# HTTP API contract (server ⇄ web)

Owned by the **server** lane; change it in the same commit as any route change. **web** may append under "Requested". Base path `/api`, JSON unless noted. Types live in `src/core/types.ts`.

| Method | Path | Returns | Notes |
|---|---|---|---|
| GET | `/api/health` | `{ ok: true, version, demo: boolean }` | liveness |
| GET | `/api/loops` | `LoopSummary[]` | Fleet; sorted by attention (failing, blocked, building, waiting, done) |
| GET | `/api/loops/:id` | `LoopDetail` | summary + timeline (commits), contract (done-when items with pass/fail), knowledge, decisions |
| GET | `/api/inbox` | `InboxItem[]` | every BLOCKED.md: loop id, file, question, best guess, since |
| POST | `/api/loops/:id/answer` | `{ ok: true, commit, pushed }` | body `{ file: "BLOCKED.md", answer }`: writes the answer to task.md, deletes BLOCKED.md, commits, then pushes if it can (`pushed: false` when there is no remote or it is offline). Errors are `{ error }`: 400 bad body, 404 unknown loop, 409 demo (`"demo is read-only"`), 422 git/answer failure |
| GET | `/api/checks` | `HealthCheck[]` | Health page: `{ loopId, kind, ok, reason, proof }` |
| GET | `/api/settings` | `DashboardSettings` | `{ demo, projectsDir?, ghAccount?, defaultRunner }`; demo mode returns only `demo` and `defaultRunner`. `ghAccount` comes from `gh api user` (absent when `gh` is missing or signed out). Read-only. |
| GET | `/api/events` | SSE | first event `ready`, then `loop-updated` (data `{"id"}`), `inbox-changed`, `checks-changed` (data `{}`; reserved, not sent until health checks refresh on their own); a `: keep-alive` comment every 25 s. Real mode polls the clones every 5 s and `git fetch`es every 5 min; demo mode only sends `ready`. |

**LoopSummary (draft; server finalises it in types.ts):** `{ id, name, url?, state: LoopState, reason, round, roundsTotal, run, runLimit, nextRunAt?, tests?: { passed, failed, at }, live?: { ok, status, leaked: string[] }, pages?, lastCommit?: { sha, at, message } }`

**Lanes (round 2):** `LoopSummary` and `LoopDetail` carry optional `lanes?: LaneStatus[]` (type in `src/core/types.ts`; present only when the clone has `.ai/lanes.json`, one entry per lane in that file's order). `LaneStatus` = `{ name, state: 'building'|'waiting'|'blocked'|'done'|'stalled', run, limit, lastCommit?: { sha, subject, at }, locked, waitingOn?: string[], unanswered: { from, to, at, text }[] }`. Read by core's `readLaneStatuses`. `state` rules: BLOCKED/DONE in the lane folder or repo root win; `building` = fresh lane lock (under 90 min); `stalled` = no commit or lock for over 120 min (2 cron periods) and no stop file; else `waiting`. `unanswered` = messages to a named lane with no later outbox entry or commit from it; `waitingOn` = lanes this lane has such messages open to. `/api/checks` adds two kinds for laned loops: `lane-stalled` and `lane-waiting-on-finished` (a non-done lane waits on a done lane); a failing one turns the loop `failing` with that reason. Web's Needs-you count: any lane `blocked`/`stalled`, or any `lane-waiting-on-finished` check failing.

**Guard (all routes):** `Host` must be loopback (`127.0.0.1`, `localhost`, `[::1]`) and `Origin`, when sent, must be a loopback page, else `403 { error: "forbidden" }`. POSTs must send `Content-Type: application/json` (else 415). A dev proxy must keep a loopback Host/Origin. The answer text is stored as typed (the word `accept` is not a command).

**Static files:** every non-`/api` GET serves `dist/web` (unknown extension-less paths fall back to `index.html`) with a strict CSP (`default-src 'none'`, scripts/fonts/connect only from `'self'`), `nosniff` and no-referrer.

**Static demo (GitHub Pages):** `npm run build` then `node demo/export-static.mjs` writes `demo/static/api/{health,loops,inbox,checks}.json` and `demo/static/api/loops/<id>.json`, the same bodies as the live demo API. Web's static mode fetches these as *relative* URLs (`api/loops.json`, no leading slash) so a Pages sub-path works, and hides the answer form.

## Requested
(web appends: date · what · why)
- ~~2026-10-08 · `GET /api/settings` → `{ projectsDir, ghAccount?, defaultRunner }` (read-only is fine) · web Settings screen should show projects folder, gh account and default runner (IDEA/web contract); today it only links to `loop dashboard --help`.~~ Shipped 2026-10-08.
- ~~2026-10-08 · Lanes data for the dashboard (IDEA Round 2 must-have 6). Add optional `lanes?: LaneStatus[]` to `LoopSummary` (Fleet strip) and `LoopDetail` (Lanes tab), plus a sixth demo loop that has them. Proposed `LaneStatus`: `{ name: string; state: 'building'|'waiting'|'blocked'|'done'|'stalled'; run: number; limit: number; lastCommit?: { sha: string; subject: string; at: string }; locked: boolean; waitingOn?: string[] /* lane names */; unanswered: { from: string; to: string; at: string; text: string }[] }`. Web needs `stalled` and `waitingOn` to count "Needs you". Web builds against a fixture until this ships, and the types can be added to `src/core/types.ts` by whoever lands first (add only).~~ Shipped 2026-10-08 as `lanes?: LaneStatus[]` (core's `LaneStatus`, see Lanes above); `waitingOn` and `unanswered` as proposed. The sixth demo loop follows (unit 5).
