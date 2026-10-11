# core lane: DONE (round 4, 0.4.0 "Control")

**Built:** `loop pause` / `loop resume` and browser-safe `.ai/PAUSED` parsing (`loop run` and `loop status` honour it); run log (`loop runs log`, `loop runs [--json]`, `parseRunLog`, `expectedSlots`, `matchSlots`, `missedInARow`); lanes-aware `loop next-round --brief` (`--dry-run`, `--json`, `--no-commit`); `loop ship-check [--json]` with the pure `shipCheck` and a browser-safe CHANGELOG parser; `LoopCommit.author`, `commitLane`, `latestControlNotes`; `check-lanes` rules for `Lane: release` and `Lane: control`.
**Tests:** `npm test` green on 2026-10-11 (513 unit passed, e2e green). Audit: `.ai/audit/core.md`, R4-1 to R4-5 fixed, no open blocker. Three reviewer passes; blockers and majors fixed (pause remote sync and rollback, slot attribution of long runs, untracked brief commit, "not a blocker" wording).
**Unsure:** `.ai/last-test.json` still has no writer in this repo (the run log carries test counts instead); `matchSlots` attributes commits to slots by end time only; the DEFAULT_PROMPT in `runPrompt.ts` has no pause rule until kit adds it to `runners/routine/prompt.md` (the lane intro has it).

## 10 best next improvements
1. `loop run` writes its own run-log line, so local runs show on the Runs tab without the agent doing it.
2. Pause rule and run-log step in `DEFAULT_PROMPT` once kit's prompt.md has them.
3. Share the lock-pid staleness check via `src/core/parse` so the dashboard uses it.
4. `loop status --json` for scripting.
5. `loop ship-check` also checks the remote tag and npm for the version.
6. `loop pause --lane <l>` for a single lane.
7. `loop next-round --brief` refuses (or warns loudly) on a brief that scores below the minimum.
8. Support Volta/Scoop launcher layouts for `loop run` on Windows.
9. `loop next` prefers stalled lanes that others depend on.
10. A `loop runs --since <date>` and per-lane summary line for the Fleet card.
