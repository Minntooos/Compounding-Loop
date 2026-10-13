# DONE: server lane, round 5 (0.5.0 "Cockpit")

Finished 2026-10-13 in 18 runs (budget 20). Fresh pull: check, typecheck and unit green (936 passed, 3 skipped). Sprint pace per `.ai/policy.json`: build and e2e not run this run; CI covers every push. Unit 7's reviewer step skipped by pace.

## What was built
- A1 shipped detection (tag + npm latest when readable), npm state per release, `registry.npmjs.org` in the static CSP; A7 local fleet cards with CI, tests and domain.
- Demo fixtures: run log outcomes, schedule (sleeping and snoozed lanes), steer entries, release and pace data; self lane states.
- Routes: schedule, steer, schedule actions, pace (`GET/POST`), draft-brief SSE (fake `claude` in tests), run outcomes via `classifyRunSlots`; GitHub prefill URL builders. All in `.ai/contracts.md`.
- Owner steer fixes: round label off-by-one, not-due lanes never stalled. Web asks: `QUIET_KINDS` export, lane-count pass reason, `abortableClaude` test.

## Unsure
- Nothing open. `1f27d58` touched core's `repo.ts` under an owner steer (control room accepted it).

## 10 best next improvements (by value to users)
1. Cache `readSilentItem` git work per poll tick.
2. Etag/conditional requests for live GitHub fetches to save rate limit.
3. Timeouts and `GIT_TERMINAL_PROMPT=0` on git calls in pause/resume (core's `pause.ts`).
4. Search Console data when a local key is configured.
5. Refresh the self snapshot to a newer pin automatically in release prep.
6. Pass `as` from the server so pause works when git `user.name` is unset.
7. Paged inbox for loops with many BLOCKED questions.
8. Push SSE events for remote loops without webhooks.
9. Rebase retry on next-round push.
10. Optional npm download counts on the release card.
