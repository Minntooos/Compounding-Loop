# Lane: server — round 2 (0.2.0 "Lanes")

Run: 1 / 20
Status: in progress
Round 1 record: `.ai/lanes/server/done-v1.md` (`git show 3385cdf:.ai/lanes/server/task.md` for its Decisions).

## Contract
**Goal:** the API serves lanes for real loops and for the demo, and the demo shows this repo building itself (IDEA.md "Round 2", must-have 6, data side).
**Done when:**
- `npm test` passes, and `.ai/audit/server.md` exists with no open blocker.
- The API returns lanes per loop: name, state, run N/LIMIT, last commit (hash, time), DONE/BLOCKED, lock age, and unanswered outbox messages with sender → recipient. It uses core's `src/core/lanes.ts`. `.ai/contracts.md` is updated first, and web is told in your outbox.
- Health: a lane with no commit for more than 2 cron periods and no stop file shows **stalled**. A lane that waits on a lane with DONE shows **waiting on finished lane** (the exact failure round 1 hit; see `.ai/control-room.md` 2026-10-08 12:35).
- Demo: a sixth loop, "compounding-loop (this repo)", made from a scrubbed snapshot of this repo's round-1 lane files and commit history. The scrub test proves there are no emails, local paths, tokens or routine IDs. The five-site numbers are unchanged, so the existing e2e asserts still pass.
- Round 1 leftovers that make real loops honest: read `.ai/runs.jsonl` and `.ai/last-test.json` (written by core/kit), and add a leak check for GitHub Pages, Vercel and Cloudflare Pages configs besides `netlify.toml`.
**Constraints:** round 1 rules (loopback guard, `execFile` arrays, no stored tokens, no network in tests). The demo stays static-exportable for GitHub Pages.
**Out of scope:** UI (web), CLI (core).

## Units, in order
1. **Audit** (`.ai/audit/server.md`):
   - every route's errors and status codes;
   - the loopback/Host guard;
   - path traversal on any route that takes a loop id or path;
   - the SSE reconnect and cleanup;
   - performance with 20 loops (fixture);
   - whether the demo scrub is complete (grep the built demo for anything private);
   - that `/api/settings` exists (web round 1 waited for it).
   Fix blockers.
2. Contracts update for lanes, plus a message to web.
3. Lanes in the API + tests (if core's `lanes.ts` isn't there yet, write against the `.ai/lanes.json` shape in IDEA.md, and swap to core's parser when it lands).
4. Lane health rules + tests.
5. The demo loop for this repo + the scrub test.
6. Majors from your audit, then the round 1 leftovers above.

## Decisions

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns, except for the "main stays green" fix.
- Put anything from `.ai/reference/` into `demo/` unscrubbed.

## Handoff
Round 2 starts here. Commits carry a `Lane: server` trailer (CLAUDE.md).
