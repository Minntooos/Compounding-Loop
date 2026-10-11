# core lane: DONE (round 2, 0.2.0 "Lanes")

**Built:** `src/core/lanes.ts` (parse/validate `.ai/lanes.json`, glob matching, `Lane:` trailer checks); `loop check-lanes`; `loop init --lanes` and `loop lanes add` (CLAUDE.md and AGENTS.md merge); `loop doctor`; `loop run --lane` with session locks (kept until the child settles on Ctrl-C); `loop status` lane rows; `answer --push`; `loop new` keeps the folder on gh failure; `claude.cmd` shims started via their package entry or the script named in the shim.
**Tests:** `npm test` green on 2026-10-11 (check, typecheck, unit, build, 92 e2e passed). Audit: `.ai/audit/core.md`, no open blocker.
**Unsure:** Volta shims (they call a launcher, not a .js) are not covered; `npx compounding-loop` cold start was never measured (needs network).

## 10 best next improvements
1. Support Volta/Scoop launcher layouts for `loop run` on Windows.
2. `loop doctor --fix` that prints or runs the install commands.
3. Measure and trim `npx compounding-loop` cold start (lazy imports).
4. Case-insensitive lane globs on Windows/macOS file systems.
5. Overlap detection for exotic glob pairs (`**/*.ts` vs `src/**`).
6. `loop check-lanes --fix-hint` that suggests the right lane for a crossing file.
7. Core-side writer for `.ai/last-test.json` in `loop run` so every template reports tests.
8. `loop status --json` for scripting and CI.
9. Retry/backoff and clearer messages for `gh` rate limits in `loop new`.
10. A `loop lanes remove`/`rename` command that keeps outboxes intact.
