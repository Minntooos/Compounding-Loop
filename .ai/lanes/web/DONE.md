# web lane: DONE (round 4, 0.4.0 "Control")

**Built:** Runs tab and fleet-card newest-run line, "no run recorded" attention item, Tests tab (count over time, last failure, "Show as table"), Ready to ship panel, Releases tab, paused notice, ControlBar (Pause/Resume, Start next round, Release with a confirm step; GitHub-URL fallback on the static demo, local action on the server), toasts, per-lane Contract/Decisions/Knowledge, control-room notes, doctor on Health, Inbox edit links, commit authors, bugs A1-A9, `web/DESIGN.md` extended.
**Tests:** `npm test` green on 2026-10-12 (144 e2e passed, 30 skipped). Independent design review recorded in `.ai/audit/web.md` (afa659e); screenshots re-shot.
**Unsure:** Runs, Paused and Ready-to-ship screens have no after-screenshots because the pinned self snapshot has no run log; Health row labels are snapshot data ("proj1..5").

## 10 best next improvements
1. Compress `docs/assets/screens/self-*-phone.png` (~5.4 MB each).
2. Tests tab: link each run's commit (needs a sha per run from server).
3. Runs/Tests/Paused/Ready-to-ship screenshots once the self snapshot carries run-log data.
4. Rate-limited and error states on the Tests tab (loading/error/rate-limited per DESIGN.md).
5. Tests tab chart as a line, not bars, per DESIGN.md.
6. Health row labels and reason/label overlap polish.
7. Snapshot chip spacing at 375 px.
8. Toasts for GitHub-link action paths and untested Resume/Next round paths.
9. Long-brief fallback: Copy plus blank new-file page when the prefilled URL is too long.
10. Server-exposed silent-lane list instead of the client-derived one in `web/src/lib/runs.ts`.
