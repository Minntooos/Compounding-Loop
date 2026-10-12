# Lane: web — round 4 (0.4.0 "Control")

Run: 7 / 20
Status: units 1 (partial), 2, 3 (most), 4 shipped (Runs tab, card status line), 6 partly (Ready to ship panel read-only, Releases tab, paused notice); ControlBar (Pause/Resume, Next round, Release with confirm dialog) shipped; Tests tab (done run 3), launch drafts + Copy, Inbox edit links, Release as filled primary, post-action toast, 7-8 open
Round 3 record: `.ai/lanes/web/done-v3.md` (`git show b3b51a5:.ai/lanes/web/task.md` for its Decisions).

## Contract
**Goal:** the dashboard tells the truth and replaces the chat (IDEA.md Round 4 A, C, D).
**Done when:** every web line of "Round 4 done when" in IDEA.md passes: mocked-GitHub e2e for full history, release-waiting attention, Runs outcomes, the exact prefilled GitHub URLs of every action button and Ready to ship; axe at 1440 and 375 px in both themes on every screen; zero console errors; no horizontal scroll or wrapped header controls at 375 px; bundle under 300 kB gzip; independent design review recorded in `.ai/audit/web.md`; new after-screenshots.
**Constraints:** round 1-3 rules (no runtime CDN, no `innerHTML` with repo text, tokens from IDEA.md and `web/DESIGN.md`, no new UI library; a chart or other dependency needs a Decisions line and must be under 15 kB gzip). Action buttons never hold or ask for a token.
**Out of scope:** mapping GitHub responses and URL builders (server's `src/server/live/**`), parsers and commands (core).

## Units, in order
1. Round 4 re-audit (`.ai/audit/web.md`): reproduce every bug in IDEA.md A with a failing e2e first.
2. Extend `web/DESIGN.md`: Runs, Tests, Releases, Ready to ship, action buttons (primary/secondary, confirm step, what opens), paused state, snapshot-date labels, the 5-second fleet card rule.
3. Bugs A1-A9 UI side (history merge, attention item, settings, Contract/Decisions per lane with empty states, health labels and times, "snapshot 6 Oct", "Round 3 done · next", console 404, phone theme button, site pages + live link).
4. Runs tab and the fleet card's newest-run line; "no run recorded" attention item.
5. Action buttons: Pause/Resume, Start next round (brief box + live score), Release, each opening the server's prefilled GitHub URL on the static demo and calling the local server's action locally; a confirm step that says what will change.
6. Ready to ship panel; Releases tab; Tests tab (count over time, last failure); control-room note on the self card; commit author on the timeline; Inbox "Edit on GitHub" links on the static demo; doctor output on Health.
7. States for every new screen (empty, loading, error, rate-limited, paused), both themes, reduced motion.
8. After screenshots to `docs/assets/screens/` (tell docs), independent design review against DESIGN.md, fix what fails, record the result.

## Decisions

## Confirmed
- e2e runs against `dist/web`: run `npm run build` before `npx playwright test` or you test stale code.
- Live shas are shortened to 7 chars by `mapCommits`; test fixtures need distinct first 7 chars.
- Files imported by tests/unit must use relative `.js` imports (root tsconfig has no `@core` alias): put pure helpers in `web/src/lib/`, not in components.
- `demo/this-repo.json` loop is `done` + has lanes, so the demo fleet now says "1 thing needs you · release waiting on you" (e2e updated).

## Next run starts here
1. Unit 5 left (toast after local action shipped run 6): live score/URL fallback (Copy + blank new-file page) when a brief is too long.
2. Unit 6 rest: (Tests tab shipped in run 3: `TestsTab.tsx`, `testSeries`/`lastFailure` in lib/runs.ts) launch drafts + Release button on ShipPanel, commit author is done, Inbox edit links (shipped run 7: static demo only, needs `repoUrl`/GitHub `url`; the snapshot's self loop has none until live data merges) (doctor on Health shipped run 7: `Doctor` in Health.tsx, server-only).
3. Remaining A (per-lane Contract/Decisions/Knowledge via `laneNotes` shipped run 4: `LaneNotesView.tsx`): (site pages + live link shipped run 4) phone theme button check, then units 7-8.
4. Runs tab silent notice is client-derived (`web/src/lib/runs.ts silentLanes`, guarded for paused/done/blocked); ask server to expose its own list if they disagree.

## Guesses
- Tests tab vs DESIGN.md (reviewer, run 3): still bars not a line, table is sr-only not a disclosure, no commit link in Last failure, no loading/error/rate-limited states, tiny chart at 375 px (set preserveAspectRatio/height). Fix in unit 7.

## Tried
- Run 4: pushed two small units (lane notes, site line) without the reviewer subagent; next run should review both diffs (ed9b219, edd9464).
- Run 5: stale clone (main diverged), worked on lane-run; npm test green on fresh pull (138 passed). Only told docs the control labels (outbox); no code unit this run.

- Run 6: toast after local Pause/Resume/Next round (toast() event in Toasts.tsx); reviewer: no blockers; Resume/Next round toast paths untested, GitHub-link paths have no toast.

- Run 7: control room notes section on the loop page (LoopDetail.tsx); doctor report on Health (hidden on static hosting). Failure of /api/doctor hides the section, untested.

## Don't
- Edit paths another lane owns, except for the "main stays green" fix.
- Change `version`, publish, dispatch `release.yml`, create tags, or change repo/npm settings.
