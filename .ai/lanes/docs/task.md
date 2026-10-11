# Lane: docs — round 3 (0.3.0 "Showcase")

Run: 0 / 20
Status: not started
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
