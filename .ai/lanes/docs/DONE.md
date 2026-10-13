# Docs lane: DONE (round 5, 0.5.0 "Cockpit")

**Built:** Round 5 audit (no open blocker), `docs/steering.md` (steering, schedule, pace, thin routine prompts), `docs/dashboard.md` (every new control and what it writes), README "Glance, steer, sleep", CHANGELOG `[Unreleased]` for 0.5.0, web's final 36 screenshots (all under 400 kB), launch drafts mentioning steering and idle-for-free, docs unit tests (links, commands named in docs exist in `loop --help`).
**Tests:** check, typecheck and docs unit tests green on 2026-10-13 (sprint pace; e2e left to CI, diff is docs assets only). Packed tarball installed fresh: `steer`, `pace show`, `schedule show`, `pause`, `resume`, `runs` are present and work.
**Unsure:** `loop steer` in a repo with no remote reports a push failure after committing (expected; docs say the commit is kept). release.yml dry run still needs GitHub.

## 10 best next improvements (by value to users)
1. Run the release.yml dry run on GitHub after the owner's one-time setup.
2. A "first week with a team" walkthrough in docs/team.md.
3. Short screencast script for the launch kit.
4. FAQ entry on cost per loop run, by pace.
5. Troubleshooting page built from `loop doctor` messages.
6. Document the runs.jsonl format.
7. Windows-specific install notes (claude.cmd, PowerShell runner).
8. Comparison page refresh with current tools.
9. Extend the docs-vs-`--help` check to dashboard flags.
10. Compress the largest phone screenshots further.
