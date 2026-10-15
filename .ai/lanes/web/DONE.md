# web lane: DONE (round 6, 0.6.0 "Memory + proof")

**Built:** the Knowledge & recipes tab (index entries with trigger badges, recipe cards with a copy-context button, plain and lane notes kept visible while knowledge loads or fails) and the Eval view (task × arm × model table, headline sentence, visible **sample** marking on demo data, empty state naming `loop eval run`). Files: `web/src/**/KnowledgeTab.tsx`, `EvalView.tsx`, `lib/knowledge.ts`, `tests/e2e/knowledge.spec.ts`.
**Tests:** last full `npm test` (run 1, 2026-10-14): 277 e2e passed. Run 2 touched one component; per the owner's standing steer of 2026-10-15 no tests ran after that, CI is the judge. This run changed only lane files, no code. JS bundle 170 kB gzip (limit 300) at run 1.
**Design review:** independent reviewer per unit in `.ai/audit/web.md` (run 1: one blocker and minors fixed; run 2: audit minors fixed). Axe and screenshot done-whens count as met by green CI plus this note, per the standing steer.
**Unsure:** the eval and knowledge views were only checked against server's demo fixtures (`demo/memory.json`), not a live repo with real eval runs.

## 10 best next improvements (by value to users)
1. Link a knowledge entry's trigger badge to the transcript or run that fired it.
2. Eval table: sort and filter by arm/model, with a per-task drill-down to the run output.
3. Auto-downshift notice in the Pace block once core/server expose why a pace changed.
4. Amber limit stops beside "Nothing needs you": say they resume by themselves.
5. Phone strip: bring back "in 5 h" / "next:" in a second line via a DESIGN.md pass.
6. Heat map on phone: full lane names or a legend instead of one-letter labels.
7. Recipe card: show match score and the last time it was applied.
8. Toast Undo for schedule buttons.
9. Unit picker for the steer composer once lane unit lists reach the browser.
10. Split the JS chunk (code-split the loop page) to speed first paint on phones.
