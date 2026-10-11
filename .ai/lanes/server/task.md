# Lane: server — round 3 (0.3.0 "Showcase")

Run: 1 / 20
Status: run 1: units 1-4 done (audit, rounds 1+2 snapshot pinned 084bb9f, live mappers, static CSP + live.json); unit 5 open (claims in live already; audit majors none)
Round 2 record: `.ai/lanes/server/done-v2.md` (`git show 084bb9f:.ai/lanes/server/task.md` for its Decisions).

## Contract
**Goal:** the live data path for the demo and a self-build snapshot that tells the story (IDEA.md Round 3 must-haves 2 and 3).
**Done when:** `npm test` passes; Round 3 audit section with no open blocker; `src/server/live/**` is pure, browser-safe and unit-tested against recorded GitHub response fixtures (scrubbed: no emails, no author names).
**Out of scope:** fetching and caching in the browser, UI (web).

## Units, in order
1. Round 3 re-audit (`.ai/audit/server.md`).
2. Self-build snapshot covering rounds 1 and 2 (pin 084bb9f), round/test/live fields that read like a story; update `demo/build-self.mjs` and its tests.
3. `src/server/live/**`: pure mappers from GitHub commits API, Actions runs API and raw file contents to the dashboard's existing API types (loop summary, lanes, timeline, inbox), using core's browser-safe parsers. Export the list of URLs the browser must fetch (a pure function of the repo slug) so web can call it. Add the shape to `.ai/contracts.md`.
4. Static export: a `live.json` config (`{ "repo": "Minntooos/Compounding-Loop", "loop": "<self loop id>" }`) and a CSP whose `connect-src` allows exactly `https://api.github.com` and `https://raw.githubusercontent.com`; the local server CSP is unchanged (test both).
5. Claims in the API types and reader (after core's unit 5). Then audit majors.

## Decisions
- Fixtures in tests/unit/server/fixtures/live are hand-written to the documented GitHub API shape (no network in cloud runs), with no names or emails.
- Moved `laneChecks` to src/server/laneChecks.ts and `bulletsUnder`/`contractFromTask` to src/server/taskBullets.ts so live/ stays browser-safe; old modules re-export them.
- CSP for the hosted demo is a meta tag written by demo/export-static.mjs into demo/static/index.html (workflow already copies demo/static over dist/web).

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns, except for the "main stays green" fix.

## Handoff
Round 3 starts here. Brief: IDEA.md "Round 3". Commits carry a `Lane: server` trailer.

## Handoff (run 1)
Units 1-4 done; unit 5 claims are already in types/reader (core) and the live mapper. Remaining: confirm web's live fetch uses `src/server/live` and field gaps web reports in its outbox; `tests` result for the self loop is not in the snapshot (no count recorded at the pin). Done: units 1, 2, 3, 4, 5.
