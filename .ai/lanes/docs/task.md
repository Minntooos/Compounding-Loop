# Lane: docs — round 3 (0.3.0 "Showcase")

Run: 4 / 20
Status: units 1-5 and 6 (fresh-install recorded) done; remaining: README screenshots swap once web unit 9 lands, then DONE
Round 2 record: `.ai/lanes/docs/done-v2.md` (`git show 084bb9f:.ai/lanes/docs/task.md` for its Decisions).

## Contract
**Goal:** a visitor understands the product from the README's first screen and can watch it build itself; a teammate can join with one page (IDEA.md Round 3 must-haves 5 and 6).
**Done when:** `npm test` passes; Round 3 audit section with no open blocker; README/docs checks pass; the fresh-install test (README quick start + `docs/team.md`, word for word, from a packed tarball in an empty temp dir) is recorded in `.ai/audit/docs.md`.
**Out of scope:** the UI itself (web), CLI behaviour (core).

## Units, in order
1. Round 3 re-audit (`.ai/audit/docs.md`).
2. `docs/team.md` ("Work on a loop with a teammate", five steps) once core's `loop claim/next` land; linked from the README. Start the outline from IDEA.md now.
3. README first screen: the live demo link ("watch this repo build itself"), new screenshots from web, the team workflow, an FAQ line on GitHub's 60 requests/hour limit and the snapshot fallback.
4. `launch/` drafts updated to lead with the live self-build; CHANGELOG `[Unreleased]` for 0.3.0.
5. Pages workflow paths include `src/core/**`; keep CI's lane check.
6. Fresh-install test, then audit majors.

## Decisions

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns, except for the "main stays green" fix.

## Handoff
Round 3 starts here. Brief: IDEA.md "Round 3". Commits carry a `Lane: docs` trailer.

## Handoff (run 1, 2026-10-11)
Done: unit 1 (Round 3 audit in `.ai/audit/docs.md`), unit 5 (Pages paths include `src/core/**`; ci.yml already runs check-lanes). Local clone had unrelated history to origin/main; reset local main to origin/main (old one kept as local branch `backup-old-main`, not pushed).
Next: units 2-4, 6 are blocked until core ships `loop next/claim/release` (check 7 would fail on them), web ships the new UI and screenshots, and server/web ship live mode. Re-check `node bin/loop.js --help` and the other outboxes first.

## Handoff (run 2, 2026-10-11 ~06:00 UTC)
Done: unit 2 (`docs/team.md`, linked from README, lanes.md, getting-started incl. `/loop-next`), CHANGELOG `[Unreleased]` started (unit 4 partly). Verified the claim/refuse behaviour in a temp repo.
Next: unit 3 (README first screen, new screenshots, live-demo link, FAQ rate-limit line) waits for web's new screenshots and server/web live mode; the rate-limit FAQ must not ship before live mode does. Unit 4: update `launch/*.md` to lead with the live self-build once live mode is on main (also drop the stale "three crossings" FAQ lines if `loop check-lanes` is clean). Unit 6: fresh-install test from a packed tarball. Check other outboxes first.

## Handoff (run 3, 2026-10-11 ~07:00 UTC)
Done: unit 3 except screenshots (README leads with "Watch this repo build itself", snapshot/rate-limit FAQ), unit 4 (launch FAQ now honest: check-lanes flags one commit; Show HN leads with live demo; CHANGELOG), `/loop-lanes` in getting-started, unit 6 (fresh-install recorded in .ai/audit/docs.md).
Next: when web ships new screenshots (their unit 9), swap them into README and docs/assets/screens, then run the retro and write DONE.md (read outboxes first). Local main had unrelated history again at run start; `git reset --hard origin/main` fixed it.

## Handoff (run 4, 2026-10-11 ~08:00 UTC)
Nothing new to do: web unit 9 (new screenshots) has not landed (web Run 4/20, unit 9 last; control room asked web for self-card fixes first). Local main had diverged from origin again; `git reset --hard origin/main` fixed it (old state kept as local branch `backup-stale-main`).
Next: when web ships screenshots, swap them into README and docs/assets/screens, run the retro, write DONE.md (read outboxes first).
