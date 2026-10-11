# Lane DONE: web (round 3, 0.3.0 "Showcase")

**Built:** `web/DESIGN.md` (research, tokens, per-screen layout) plus before/after screenshots of every screen in both themes (`web/design/`, `docs/assets/screens/`); welcome strip with copyable install command and live/snapshot chip; live mode from GitHub (tree listing, 5 min sessionStorage cache, refresh while visible, rate-limit and unreachable fallback to the snapshot); fleet cards with round/lane progress and run-budget bars, self-build card first; Timeline grouped by UTC day with lane colours, lane filter and sticky day headings; commits-per-day chart; claims in the Lanes tab; phone nav that fits; the 404 fixed; shared Notice, skeleton loading and rate-limited states. Independent design review recorded in `.ai/audit/web.md`.
**Tests:** `npm test` green on 2026-10-11: 120 e2e passed (30 skipped by design), 452 unit passed. Mocked-GitHub e2e covers live, 403 fallback and copy command; axe clean in both themes at 1440 and 375 px.
**Unsure:** the self card's live-site URL is assumed to be the GitHub Pages URL. The self card's story line can contradict its Done badge when live data is stale (the text comes from server data).

## 10 best next improvements
1. Per-screen skeleton shapes (today one generic skeleton).
2. Self-card story line derived from the badge state, so they cannot disagree.
3. Runs/tests-over-time chart once the API records run history (today commits per day).
4. Cut a cold live load from 3 anonymous API calls to 2 to spare the 60/h limit.
5. Motion on change: brief highlight when SSE updates a card (respect reduced motion).
6. Persist Fleet filter and Timeline lane filter in the URL hash.
7. Inbox: Markdown preview of the reply draft.
8. Command palette actions (open lane, jump to inbox item).
9. Visual regression screenshots compared in CI.
10. Lazy-load the New loop screen to shave first-load JS.
