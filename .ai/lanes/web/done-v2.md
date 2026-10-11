# Lane DONE: web (round 2)

**Built:** axe check on every screen (both themes, laptop + phone, zero serious/critical); Settings wired to `GET /api/settings`; Lanes tab, Fleet lane strip and Needs-you lane counts (fixture and demo e2e); SSE toasts; Fleet status filter; 375 px overflow e2e incl. long names and paths (fixed two real overflows in run 5); screenshots of every screen in `docs/assets/screens/`; audit in `.ai/audit/web.md` with no open blocker.
**Tests:** `npm test` green (90 e2e passed, 26 skipped by design: screenshots need `SCREENS=1`, keyboard shortcuts skip on phone).
**Unsure:** motion on data change (a brief highlight when a card updates) is not done.

## 10 best next improvements
1. Motion on change: highlight a card or row for a moment when SSE updates it (respect reduced motion).
2. Inbox: show the reply draft as Markdown preview before sending.
3. Fleet: sort options (needs-you first, last activity).
4. Lanes tab: click a lane to filter the loop's commit list to that lane.
5. Health: group checks by loop with collapsible sections.
6. Persist Fleet filter in the URL hash so a view can be shared.
7. Command palette: add actions (open lane, jump to inbox item).
8. Visual regression screenshots compared in CI.
9. Real-mode empty state that links to `loop new` and the docs.
10. Bundle: lazy-load the New loop screen to shave first-load JS.
