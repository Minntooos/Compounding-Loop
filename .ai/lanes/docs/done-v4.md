# Docs lane: DONE (round 4, 0.4.0 "Control")

**Built:** Round 4 audit (no open blocker), `release.yml` and `next-round.yml` with structure tests, `docs/release.md`, `docs/dashboard.md` (Controls table matches web's Pause/Resume, Start next round, Release buttons), README/CHANGELOG/launch updates, fresh-install test recorded in `.ai/audit/docs.md`.
**Tests:** `npm test` green on a fresh pull (138 e2e passed, 30 skipped; unit and checks pass).
**Unsure:** release.yml dry run needs GitHub and was never run; `pause`/`resume`/`runs`/`ship-check` take no dir argument (core); dashboard screenshots predate the new buttons (web unit 8).

## Next improvements, ranked
1. Re-shoot screenshots once web ships the Controls UI.
2. Run the release.yml dry run on GitHub after the owner's one-time setup.
3. Add a "first week with a team" walkthrough to docs/team.md.
4. Short screencast script for the launch kit.
5. FAQ entry on cost per loop run.
6. Troubleshooting page built from `loop doctor` messages.
7. Document the run log format (`runs.jsonl`) in docs.
8. Comparison page refresh with current tools.
9. Windows-specific install notes.
10. Docs-vs-`--help` check extended to dashboard flags.
