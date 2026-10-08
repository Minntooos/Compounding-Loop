# Lane: server

Run: 1 / 30
Status: in progress (units 1-7 done)

## Contract
**Goal:** the local HTTP server the dashboard talks to, plus the scrubbed demo data (IDEA.md must-haves 17–18).
**Done when:**
- `npm test` passes; `tests/unit/server/*.test.ts` hit every route in `.ai/contracts.md` with Hono's `app.request()` (no real port) against fixture repos and the demo snapshot.
- `src/server/index.ts` exports `createApp(options)` and `startServer({ port, demo, projectsDir })` returning `{ url, close }`; it serves `dist/web` statically and `/api/*`.
- SSE at `/api/events` sends `loop-updated` when a watched clone changes (test with a temp repo and a short interval).
- Git is read via `execFile('git', [...])` only; fetch every 5 min (configurable, off in tests).
- `demo/five-sites.json` is built from `.ai/reference/five-sites/*.json` by `demo/build-demo.mjs`: no emails, no local paths, no key paths, no session IDs (a test asserts each) and numbers unchanged (a test compares pages/tests/rounds with the reference).
- Health checks (IDEA.md #23) computed on the server: leak check, stale lock, runs ending in ~1 s, failing tests, runner silent > 2 cron periods. Each has a unit test.
**Constraints:** `.ai/contracts.md` is the single source of truth for the API. Change it in the same commit as any route and post in your outbox to web.
**Out of scope:** React UI (web), CLI parsing (core).

## Units, in order
1. `demo/build-demo.mjs` + `demo/five-sites.json` + scrub tests. Web needs this first: post in your outbox.
2. `createApp` with `GET /api/health`, `/api/loops`, `/api/loops/:id` from the demo data; add the types to `src/core/types.ts`.
3. Read real loops from a projects folder with core's `src/core/repo.ts` (if not shipped yet, ask core in your outbox and build against the interface).
4. `GET /api/inbox`, `POST /api/loops/:id/answer` (writes the answer, deletes BLOCKED.md, commits; demo returns 409 "demo is read-only").
5. SSE `/api/events` + watcher.
6. Health checks + `GET /api/checks`.
7. `startServer` serving `dist/web` with a strict CSP header; a static demo export (`demo/static/` with `api/*.json`) for GitHub Pages. Agree the static-mode shape with web in your outbox.

## Decisions
- Demo snapshot shape = `DemoSnapshot` in src/core/types.ts (`{generatedAt, loops: LoopDetail[], inbox, checks}`) · web needs one file, the same shapes as the API · change builder + types together.
- Demo `name` is the site domain, `state` is `done` for finished reports · simplest honest mapping · edit toLoopDetail.
- Builder is plain `.mjs` with a `.d.mts` for types · contract names build-demo.mjs · none.

## Decisions (cont.)
- Demo snapshot ships as dist/server/five-sites.json (copied by `demo/copy-demo.mjs` in `npm run build`) · CLAUDE.md forbids adding demo/ to package `files`, and scripts/check.mjs enforces it · none.

- Health inputs · leak = netlify.toml publishes repo root (offline, deterministic); stale lock = lock >= 90 min and no commit after it; runner silent = no commit/lock for 2 periods (default 60 min, runners are hourly); short runs and failing tests read optional `.ai/runs.jsonl` / `.ai/last-test.json` (no producer exists yet: asked core in outbox) · reverse: change src/server/health.ts.

## Confirmed
- demo/five-sites.json is rebuilt with `node demo/build-demo.mjs`; tests/unit/server/demo.test.ts fails if it is stale or unscrubbed.

## Guesses
(unproven beliefs; never treat one as fact in a later run)

## Tried
(what failed and why, so the next run does not repeat it)

## Don't
- Edit paths another lane owns (CLAUDE.md lane table), except for the "main stays green" fix.
- Add a dependency without a Decisions entry.

## Handoff
(each run ends by writing: where it stopped, the exact next step, anything half-done)
