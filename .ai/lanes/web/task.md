# Lane: web — round 2 (0.2.0 "Lanes")

Run: 2 / 20
Status: in progress
Round 1 record: `.ai/lanes/web/done-v1.md` (`git show 3385cdf:.ai/lanes/web/task.md` for its Decisions).

## Contract
**Goal:** the dashboard looks and feels like a product a senior designer shipped, and it shows lanes clearly. It is the screenshot every launch post leads with (IDEA.md "Round 2", must-have 6, UI side; IDEA.md "Design").
**Done when:**
- `npm test` passes, and `.ai/audit/web.md` exists with no open blocker.
- Accessibility is automated: an axe check (`@axe-core/playwright`; add it under Decisions) on every screen in both themes, at laptop and phone width, with zero serious or critical violations. Keyboard: every action is reachable, focus is visible, and the palette, `j/k` and `a` still work.
- **Lanes UI:** Loop detail gets a Lanes tab (one row per lane: state word + icon, run N/LIMIT, last commit, lock, unanswered messages "web → server"). The Fleet card for a laned loop shows a compact lane strip. The "Needs you" bar counts stalled lanes and lanes waiting on a finished lane. E2E asserts these against the demo's sixth loop (server lane).
- Settings is wired to `GET /api/settings` (round 1 gap) with an e2e.
- Visual polish pass, judged against the Design section of IDEA.md and recorded in the audit: spacing on the 4 px grid, type scale, empty states, loading states, long names and paths, 375 px width, both themes, and reduced motion. Playwright screenshots of every screen in both themes go to `docs/assets/screens/` for docs (tell docs in your outbox).
**Constraints:** round 1 rules (no runtime CDN, no `innerHTML` with repo text, tokens from IDEA.md). There is no new UI library. A new dev dependency needs a Decisions line.
**Out of scope:** API shape (ask server via `.ai/contracts.md` "Requested").

## Units, in order
1. **Audit** (`.ai/audit/web.md`). Run the demo and judge each screen as a senior product designer and as an accessibility reviewer would:
   - the 2-second "does anything need me?" test;
   - contrast in both themes;
   - focus order;
   - phone width;
   - console errors;
   - bundle size (`npm run build` output; flag anything over 300 kB gzip);
   - the 2 skipped e2e tests from round 1: why are they skipped?
   Fix blockers.
2. The axe check on all screens + fixes.
3. Settings wired.
4. The Lanes tab + the Fleet lane strip + Needs-you counts (start with the demo shape in `.ai/contracts.md`; if server's data isn't live yet, build against a fixture).
5. Polish pass + screenshots for docs.
6. Majors from your audit, then round 1 leftovers by value: toasts for SSE events, Fleet filter by status.

## Decisions
- 2026-10-08: added dev dependency `@axe-core/playwright` (the contract names it) for the a11y e2e.

## Confirmed

## Guesses

## Tried
- Unit 4 (Lanes UI) not started: demo has no laned loop and types have no lane fields yet; need server/core data first (check their outboxes next run, else build against a fixture).

## Don't
- Edit paths another lane owns, except for the "main stays green" fix. (`docs/assets/screens/**` is listed as shared in `.ai/lanes.json`, so web may write screenshots there.)

## Handoff
Run 1 done: unit 1 (audit, .ai/audit/web.md), unit 2 (axe e2e, 0 violations), unit 3 (Settings already wired). Also shipped: first screenshot set + generator (tests/e2e/screenshots.spec.ts, SCREENS=1) and the LaneStatus request in contracts.md. Next: unit 4 Lanes UI (check src/core/types.ts and .ai/contracts.md for lane shapes; else fixture), then unit 5 polish + screenshots in docs/assets/screens/.
Round 2 starts here. Commits carry a `Lane: web` trailer (CLAUDE.md).
