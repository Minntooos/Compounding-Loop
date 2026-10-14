# web lane: DONE (round 5, 0.5.0 "Cockpit")

**Built:** the cockpit (IDEA.md Round 5 A, C): C1 status strip and C2 Needs you, fed by one shared attention list (banner, strip, Inbox and nav badge always agree); C3 lane × hour heat map with readout and Runs-tab deep links; C4 steer composer with history and acknowledgements (local Save through the API, GitHub edit links on the demo); C5 schedule controls and state sentences; C6 next round with ingredients, Draft with Claude and Copy prompt; C7 Releases with tag/npm chips; C9 Pace chooser; P0 polish A1, A3, A4, A6, A8 with regression tests; `web/DESIGN.md` entries for every new component; 36 docs screenshots in `web/design/docs/` shot from the Pages demo's static api (all under 400 kB).
**Tests:** `npm test` green on 2026-10-13 20:50 UTC (run 18): 936 unit passed, 263 e2e passed (75 skipped by project), check, typecheck and build clean. JS bundle 158 kB gzip (limit 300). axe zero serious/critical on every screen, both themes, 1440 and 375 px, as covered by the e2e axe specs.
**Design review:** recorded per unit in `.ai/audit/web.md`; the final five-questions review (run 17, second pass) answered yes to needs-me, running, limit stops and CI. "Ready to ship" reads *partly* by design: while the self loop is building, the strip leaves the release segment out (DESIGN.md §12 C1) instead of claiming a release. Judged as passing.
**Unsure:** the self snapshot is server's illustrative data (run slots do not match real commit times exactly); the auto-downshift pace notice waits for a pace note from core/server.

## 10 best next improvements (by value to users)
1. Auto-downshift notice in the Pace block once core/server expose why a pace changed.
2. Amber limit stops beside "Nothing needs you": say they resume by themselves, so the owner is not alarmed.
3. Phone strip: bring back "in 5 h" / "next:" in a second line via a DESIGN.md pass (Decision run 13).
4. Heat map on phone: full lane names or a legend instead of one-letter labels.
5. "Last activity" label wraps on the building card at 375 px.
6. Legend for the docs lane's moon (sleeping/not-before) chip.
7. Toast Undo for schedule buttons (Toasts has no actions yet).
8. Token-streamed Draft with Claude once the server streams text, not only progress steps.
9. Unit picker for the steer composer once lane unit lists reach the browser (`NextLane.openUnits`).
10. Split the 522 kB JS chunk (code-split the loop page) to speed the first paint on phones.
