# DONE: server lane

Finished 2026-10-08 in 1 run (budget 30). Every unit passed `npm test` and a reviewer subagent before it was pushed to `main`.

## What was built
- `demo/build-demo.mjs` -> `demo/five-sites.json`: scrubbed (no emails, local paths, key paths, session or routine ids), numbers equal to the reference. Tests fail if the file is stale or unscrubbed.
- `src/server/index.ts`: `createApp` (Hono, testable with `app.request()`) and `startServer({ port, demo, projectsDir })` returning `{ url, close }`, bound to 127.0.0.1.
- Routes in `.ai/contracts.md`: health, loops, loop detail, inbox, answer (writes the answer, deletes BLOCKED.md, commits, pushes if it can), checks, SSE events.
- Real loops read from a projects folder with core's `repo.ts`, `status.ts` and `blocked.ts`; git only through `execFile`.
- SSE with a polling watcher (HEAD, upstream ref and status files) and a `git fetch` every 5 minutes (off in tests).
- Five health checks in `src/server/health.ts`, each unit-tested; a failing check turns the loop Failing.
- Security: loopback Host and Origin guard (DNS rebinding, CSRF), JSON-only POST, strict CSP, nosniff, traversal-safe static serving.
- Static demo export for GitHub Pages: `node demo/export-static.mjs` after `npm run build`.

## Test results
`npm test`: check, typecheck, 208 unit tests (2 skipped slow ones), build, e2e all pass.

## Unsure
- Short-run and failing-test checks read `.ai/runs.jsonl` and `.ai/last-test.json`, which no runner writes yet (asked core in the outbox). Until then they report "no data".
- Leak check only understands `netlify.toml`. Other hosts are not checked.
- `roundsTotal` for real loops equals the current round (the total is unknown).

## Next 10 improvements, by value to users
1. Make `loop run` write `.ai/runs.jsonl` and the run prompt write `.ai/last-test.json` so two health checks work end to end.
2. Probe the live site URL for `/.ai/task.md`, `/CLAUDE.md`, `/.git/config` and show real leak proof.
3. Leak check for GitHub Pages, Vercel and Cloudflare Pages configs.
4. Surface `pushed:false` from the answer route as a visible warning in the UI and CLI.
5. Cache loop reads for ~2 s and skip polling when no SSE client is connected, for folders with many clones.
6. Read pages, test counts and live status of real loops (today only the demo has them).
7. Per-loop cron period (from the runner config) for the runner-silent check.
8. Emit `checks-changed` events when a check flips.
9. Optional `--host` with an allow-list for LAN use, keeping the guard.
10. Pull (fast-forward only) from the dashboard so the owner can refresh a stale clone.
