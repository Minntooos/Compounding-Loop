# Round 6 (2026-10-14)

Method: fresh `origin/main`, read `src/server/{data,index,loops,static-export}.ts`, IDEA.md Round 6 A-E.

## Blockers
None open.

## Findings
| # | Area | Result | Severity |
|---|---|---|---|
| 1 | Routes | `/api/loops/:id/knowledge`, `/api/recipes`, `/api/eval` did not exist. Added (`src/server/memory.ts`), unit-tested, recorded in `contracts.md`. | fixed (this run) |
| 2 | Home paths | A recipe in `~/.ai/recipes` would leak the account name through its path. `RecipeSummary.path` is `~/...`, `$LOOP_HOME/...` or clone-relative, never absolute (tested). | fixed (this run) |
| 3 | Eval honesty | No results must not read as a failure or invent a number: empty rows, no headline, `sample: true` only on demo fixtures. | fixed (this run) |
| 4 | Duplicated parsing | Recipe/trigger/eval parsing here duplicates what core will ship (A3, B1, C3). Behind one module; switch to core's exports when they land (core outbox). | minor, open |
| 5 | Matching | `matchRecipes` scores stack overlap only (no tag/task-text keywords). Core's `loop recipe match` is the source of truth. | minor, open |
| 6 | Perf | `/api/loops/:id/knowledge` re-reads the recipe stores and the clone's knowledge on each call (a few small files). Fine locally. | ok |

Other lanes: core owns the final eval result-line shape (see `contracts.md`); web builds the screens from `demo/memory.json`.

# Round 5 (2026-10-13)

Method: fresh `origin/main` (`npm test` green, 144 e2e pass), read `src/server/loops.ts`, `live/build.ts`, `roundState.ts`, `controls.ts`, `runs.ts`, IDEA.md Round 5 A, B6.

## Blockers
None open.

## Findings
| # | Area | Result | Severity |
|---|---|---|---|
| 1 | Shipped release | `roundState` set `releaseWaiting` from root DONE.md alone, locally and live, so 0.4.0 stayed "waiting on you" after its tag existed (A1). Fix: `src/server/shipped.ts` (tag exists, plus npm `latest` equal when readable), `shipped` on the loop, `tag`/`npm` on each release. | fixed (this run) |
| 2 | Static CSP | `connect-src` had no npm host. Fix: `https://registry.npmjs.org` added to `LIVE_CONNECT_HOSTS`. | fixed (this run) |
| 3 | Local cards | `readLoop` set no `ci`, `tests` or `url` (A7). Fix: CI from the tests check, `tests` from the run log or `.ai/last-test.json`, site from package.json `homepage` (https only). | fixed (this run) |
| 4 | Phantom run slots | `buildRuns` expects slots after root DONE.md only for non-stopped lanes, but ignores PAUSED/`schedule.json` and the 6 h "routines look off" rule (A2). Needs core's `classifyRunSlots`; unit 4. | major, open (blocked on core) |
| 5 | Fixtures | Demo snapshot has no run-log, schedule or steer data (web was blocked on it in round 4). Unit 3. | major, open |
| 6 | Routes | No schedule, steer or draft-brief routes yet (B6). Waits on core's `loop schedule`/`loop steer`/`next-round --draft`. | major, open |
| 7 | npm at runtime | The dashboard's live path must fetch `npmPackageUrl(name)`; web owns the fetch (outbox). Local mode never calls npm (tag alone decides). | minor |

Other lanes: web fetches npm (outbox); core: see findings 4 and 6.

# Round 4 (2026-10-11)

Method: fresh `origin/main` (local clone had unrelated history; reset), `npm test` green (120 e2e pass). Read `src/server/live/*`, `demo/build-self.mjs`, `src/server/data.ts`, the owner's brief A to D.

## Blockers
None open (the items below are this round's units, not defects hiding in shipped behaviour).

## Findings
| # | Area | Result | Severity |
|---|---|---|---|
| 1 | History cap | `demo/build-self.mjs` slices `TIMELINE_LENGTH = 100` and `liveUrls` fetches one page of 100, so the timeline loses round 1 (A1). Fix: full snapshot history, live `since` the snapshot head, paged, pure merge (unit 2). | major |
| 2 | Release waiting | `buildLiveLoop` ignores root `DONE.md` for state/inbox (A2). Fix: attention item + state (unit 3). | major |
| 3 | Settings | Live loop reports `runLimit` from root task (0) and url = repo (A3). Fix: sum lane limits, Pages URL from live config (unit 3). | major |
| 4 | Contract/Decisions | `contractFromTask` reads only the root task file; laned loops show nothing (A4). Fix: per-lane groups (unit 3). | major |
| 5 | Health labels | `HealthCheck` has `kind` only, the label is the check name (A5). Fix: result-stating `label`, formatted `proofAt` (unit 3). | major |
| 6 | Snapshot date | No `snapshotAt` on snapshot loops (A6). Fix in unit 3. | major |
| 7 | Static export | `api/settings.json` is not exported, so the static site 404s (A8). Fix in unit 3. | minor |
| 8 | Author | Mappers never read author names; core added `LoopCommit.author` (unit 2). | minor |
| 9 | Lane of commit | `parseLaneTrailer` only; release commit reads "other" (A8). Core's `commitLane` is now available (unit 3). | minor |

Other lanes: nothing to report this round.

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
| 8 | Leak check | Only `netlify.toml` is inspected. Pages, Vercel, Cloudflare configs are not (unit 6). | fixed (511ac42) |
| 9 | Run log / last test | `.ai/runs.jsonl` and `.ai/last-test.json` are already read by `checkLoop`. | ok |
| 10 | Lanes | API has no lane data yet (units 2 to 4). | fixed (396c50b) |

# Round 3 (2026-10-11)

Method: fresh pull, `npm test` green (110 e2e pass). Read `src/server/*`, `demo/*`.

## Blockers
None open.

## Findings
| # | Area | Result | Severity |
|---|---|---|---|
| 1 | Live data | Did not exist; `src/server/live/**` added with fixtures (unit 3). | fixed |
| 2 | Static CSP | Pages sends no headers and the local CSP forbids network; `STATIC_CSP` meta tag + `live.json` added (unit 4). | fixed |
| 3 | Self snapshot | rounds 1+2 snapshot (pin 084bb9f, 100 commits) shipped. | fixed |
| 4 | Claims | `LaneStatus.claim` already filled by core and by the live mapper; local real mode gets it via `readLaneStatuses`. | ok |
