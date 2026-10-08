# Audit: server (round 2, 2026-10-08)

Method: read `src/server/*`, probed `createApp` with 20 fixture loops (git repos with `.ai/task.md`), grepped `demo/five-sites.json`, ran `npm test` (green on a fresh pull).

## Blockers
None open.

## Findings
| # | Area | Result | Severity |
|---|---|---|---|
| 1 | Status codes | `GET /api/loops/:id` unknown id 404 `{error}`; `POST .../answer`: 400 bad body or wrong `file`, 404 unknown loop, 409 demo, 415 non-JSON, 422 git/answer failure; unknown `/api/*` 404 JSON; a malformed body on an unknown loop reports 400 before 404 (harmless). | ok |
| 2 | Loopback/Host guard | Foreign `Host` and foreign `Origin` both give 403 on every route (middleware runs before routes); the server listens on 127.0.0.1 only. | ok |
| 3 | Path traversal | Loop ids are matched against folder names from `readdir`, never joined into a path (`..%2F..`, `%2e%2e` give 404). `file` in the answer body must equal `BLOCKED.md`. Static handler traversal (`/..%2f..%2fetc/passwd`) gives 404. | ok |
| 4 | SSE | Subscribes to the bus, writes a 25 s keep-alive, unsubscribes on abort; `close()` calls `closeAllConnections`. Reconnect is the browser's default `EventSource` retry; the first `ready` event re-syncs. | ok |
| 5 | Performance, 20 loops | `/api/loops` 228 ms cold, `/api/checks` 58 ms, one loop 11 ms (each call re-reads every clone and runs `git log`). Fine for a local tool; revisit past ~50 loops. | ok |
| 6 | Demo scrub | `demo/five-sites.json` has no emails, home paths, tokens, or routine IDs (only the word "routine" in commit subjects). A scrub test for the sixth loop is unit 5. | ok |
| 7 | `/api/settings` | Exists, tested, web wired. | ok |
| 8 | Leak check | Only `netlify.toml` is inspected. Pages, Vercel, Cloudflare configs are not (unit 6). | open (planned) |
| 9 | Run log / last test | `.ai/runs.jsonl` and `.ai/last-test.json` are already read by `checkLoop`. | ok |
| 10 | Lanes | API has no lane data yet (units 2 to 4). | open (planned) |
