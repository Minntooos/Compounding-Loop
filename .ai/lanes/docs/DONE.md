# Docs lane: DONE (round 6, 0.6.0 "Memory + proof")

**Built:** Round 6 audit (no open blocker), `docs/memory.md` (recipes, triggers, hooks via plugin or `loop init --hooks`, cleanup), `docs/eval.md` (tasks, arms, running, report, Ollama marked unverified, hardware honesty), README "Learn once, one-shot the next" with `<!-- eval: pending -->`, CHANGELOG `[Unreleased]` incl. the objective change, launch drafts with the same placeholder.
**Tests:** per the owner's standing steer, only typecheck and build ran (green); CI judges the rest. Every documented command was run by hand in a fresh temp repo (fake runner for the eval).
**Unsure:** no dedicated unit test for the new docs' commands; `evals/` is not in package.json `files`, so a packed install has no tasks (owner's call).

## 10 best next improvements
1. Replace the `eval: pending` markers with the real headline after the owner's run.
2. A docs test that runs the commands in memory.md/eval.md in a temp repo.
3. Screenshots of the Knowledge & recipes tab and Eval view.
4. A worked "capture your first recipe" walkthrough in getting-started.
5. FAQ entries on recipes vs knowledge notes.
6. Verify the Ollama variables on real hardware and drop the "unverified" label.
7. Document shipping `evals/` once the owner decides.
8. A launch-article section on the eval method once numbers exist.
9. Cross-link memory.md from concepts.md.
10. Troubleshooting entries for hooks not firing.
