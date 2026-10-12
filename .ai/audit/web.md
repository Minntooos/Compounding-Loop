# Audit: web

## Round 4 (2026-10-11): the dashboard tells the truth and replaces the chat

Method: read IDEA.md Round 4 A/C/D against the code on a fresh pull (`npm test` green, 122 e2e). Regression tests were added with the fix in the same commit (not failing-first, noted honestly).

### Blockers
| # | Finding | Evidence | Fix | Status |
|---|---|---|---|---|
| R4-1 | Live mode fetched 100 commits only, so the timeline lost history (A1) | `liveFetch.ts` one `per_page=100` call | page `commitsSinceUrl` and merge with the snapshot | fixed, unit + e2e (109 + 102 rows) |
| R4-2 | "Nothing needs you" while a laned round is done (root DONE.md) (A2) | `lanes.ts needsYouCount` | `releaseWaiting` counts and names the release | fixed, unit + e2e |
| R4-3 | Health read "OK · Tests failing", raw ISO times (A5) | `Health.tsx` | `checkLabel`, `humanizeTimes` | fixed, unit |
| R4-4 | Release commit tagged lane "other" (A8) | `timeline.ts` | `Release x.y.z` is lane `release` | fixed, unit + e2e |

### Major (open, in task.md units)
- A3 partly: Settings shows per-lane limit and the Pages URL; the live config still lacks per-lane Contract/Decisions (needs server data, see outbox).
- A4: Contract has an empty state; per-lane Contract/Decisions grouping not built.
- A6 card label "snapshot 6 Oct" done on cards; loop-page header label not yet.
- A8: console 404 for `api/settings.json` and phone theme button not re-verified.
- A9 site page count and live link; all of section C (Runs, Pause, Next round, Release, Ready to ship, Releases, Tests tabs) not started.

### Minor
- A rate limit on page 2+ of the commit fetch drops the pages already read (shows snapshot alone, which is the safe fallback).
- The snapshot loader requests `api/loops/<id>.json`; an unknown live loop id would log one 404.

## Round 3 (2026-10-11): the dashboard as the launch

Method: `SCREENS=1 SCREENS_DIR=web/design/before npx playwright test screenshots --project=laptop` captured every screen (Fleet, Loop, Inbox, Health, Settings, New loop) in both themes at 1440 and 375 px: 24 "before" images in `web/design/before/`. Read the Fleet, Fleet-at-375 and Loop screens against IDEA.md Round 3. `npm test` was green on the fresh pull (92 passed, 26 skipped by design).

### Blockers (the launch visitor fails or is misled)
| # | Finding | Evidence | Fix |
|---|---|---|---|
| B1 | Nothing says what this is or how to install it. The page opens on a repeated title and a green "Nothing needs you" strip. | `web/design/before/fleet-light-desktop.png` | Welcome strip with one sentence, the copyable `npx compounding-loop dashboard`, GitHub link, live/snapshot indicator (unit 4). |
| B2 | Self-build card reads as unfinished: "Round 1/2", "Tests: no result", "Live: not checked". | same image, second card | Server owns the snapshot (must-have 3); web renders "Round 2 of 2 done" and hides empty rows (unit 6). |
| B3 | Phone nav wraps: "New / loop" breaks over two lines and the theme button sits on its own row. | `fleet-light-phone.png` | Scrollable tab bar with no wrapped labels, theme button in the header row (unit 3). |
| B4 | One console 404 on load (reported by the owner). | owner review 2026-10-11 | Find the missing asset request and remove it (unit 3). |

### Major
| # | Finding | Evidence | Fix |
|---|---|---|---|
| M1 | Cards are label/value tables with no progress: round and run budget are bare "5/5", "15/150". | Fleet screenshots | Round progress, run budget bar, state word + icon, last activity (unit 6). |
| M2 | Timeline is one flat 30+ row commit list, no lane colour, "4d ago" times that rot. | `loop-dark-desktop.png` | Group by day, lane colour, lane filter, absolute UTC with relative on hover (unit 7). |
| M3 | Everything reads the same weight: page title duplicates the brand in the nav, no hierarchy between a finished loop and the live one. | Fleet screenshots | Self-build card first and larger; DESIGN.md type scale (units 2, 6). |
| M4 | No live mode: the demo is a frozen snapshot with no way to see the real repo. | IDEA.md must-have 2 | Fetch, cache, fallback (unit 5), built on server's mappers. |
| M5 | No chart of runs or tests over time. | Loop screen | Small hand-written SVG per loop (unit 7). |

### Minor
- Empty area below the cards on desktop; fine, but the welcome strip should use it.
- Loading and rate-limited states exist only for load errors; rate-limited arrives with live mode (unit 8).

### Carried over, still passing
axe zero serious/critical on 6 screens x 2 themes x laptop/phone (round 2); bundle 115 kB gzip JS; no horizontal overflow at 375 px; reduced motion honoured.

### Design review (filled in at unit 9)
Pending.

---

## Round 2 (2026-10-08)

Method: ran the demo (`loop dashboard --demo`) through Playwright at laptop (1366x633) and phone (Pixel 7) in both themes; read `npm run build` output; read the two skipped tests.

## Blockers
None open.

## Findings
| # | Area | Result | Severity |
|---|---|---|---|
| 1 | Accessibility | New `tests/e2e/a11y.spec.ts`: axe (wcag2a, 2aa, 21aa) on Fleet, Loop detail, Inbox, Health, Settings, New loop x light/dark x laptop/phone = 24 runs, zero serious or critical violations. Existing contrast tests in `screens.spec.ts` still pass. | ok |
| 2 | Console errors | Smoke and screen specs assert no console or page errors; all pass. | ok |
| 3 | Bundle | JS 378 kB raw / 115 kB gzip, CSS 6.7 kB gzip, under the 300 kB gzip flag. Fonts are bundled woff2 (largest: Inter latin-ext 85 kB, only fetched when the unicode range is used). | ok |
| 4 | Skipped e2e tests | Both are `test.skip(isMobile, ...)` guards in `fleet.spec.ts` (Ctrl+K palette) and `screens.spec.ts` (j/k/a on inbox): keyboard shortcuts do not exist on touch, so the phone run skips them; the laptop run executes them. Intentional, not a hidden failure. | ok |
| 5 | Lanes UI | Built (LanesTab, LaneStrip, Needs-you counts) with e2e on fixtures and on the demo's sixth loop. | ok |
| 6 | Settings | Already wired to `GET /api/settings` with an e2e (`screens.spec.ts`: "settings shows the server settings"). Unit 3 is done. | ok |
| 7 | 375 px and motion | `tests/e2e/layout.spec.ts` asserts no horizontal overflow at 375 px on all screens incl. the laned loop; `index.css` honours `prefers-reduced-motion`. Screenshots in `docs/assets/screens/`. | ok |
| 8 | Long text | New layout e2e feeds a 140-char name, a path-like reason, commit subject and unanswered message at 375 px. It found real overflow (Fleet reason, Lanes commit line); fixed with `overflow-wrap:anywhere`. Empty and loading states are covered by `QueryState` and the "No loops yet" card (screens.spec.ts). | ok (fixed) |

## Round 3 independent design review (2026-10-11, run 6)
Reviewer subagent (did not write the UI) compared `web/design/after/*` with DESIGN.md §5/§10 and IDEA.md.
- Its three blockers (no welcome strip, no live/snapshot chip, no lane features) were a capture fault: the screenshots ran against a live dashboard server, which hides the strip and chip by design, and showed a non-lane site. Fixed in `tests/e2e/screenshots.spec.ts` (demo mode via a 404 health route; new `self` screen for the self-build loop). Re-shot: strip, chip, lane colours, lane filter, day groups and commits-per-day chart are visible.
- Still open, minor: loop header shows "Round 2/3 · Run 36/250" as mono text (no bar); phone tab rows clip "Settings" without a scroll cue and loop tabs wrap to two rows; self-build card story line contradicts its "Done" badge when live data is stale; fleet cards lack run bars; orphan card in the 3-up grid; the bundled snapshot has no self-build card (server's data, dated 6 Oct).
- Not reviewed by the subagent: inbox, health, new, settings, and states (covered by axe and e2e).

## Round 4 independent design review (2026-10-12, run 11)
Reviewer subagent (did not write the UI) read `docs/assets/screens/*` against DESIGN.md and IDEA.md Round 4.
- Blocker, fixed: the phone screenshots were stale (pre-round-3 UI, theme toggle wrapping). Re-shot with `SCREENS=1 npx playwright test screenshots --project=phone`; theme button, snapshot chip and welcome strip now share the header row, cards have progress bars.
- Open, data not UI: the snapshot has no run log and no self card in the fleet grid, so Runs/Tests/Releases tabs, newest-run line, Paused, Ready to ship and the confirm dialog appear in no screenshot (they are covered by fixture e2e). Needs server fixture data for a laned, paused or ready-to-ship loop; screenshot specs should then use it.
- Open, minor: Health rows read "proj1..proj5" in the demo (snapshot data), duplicated check label/sub-line; fleet h1 repeats the brand name; "Snapshot from" chip spacing; welcome strip text wraps at ~55% width; loop/health pages show the snapshot date only in the header chip. Not reviewed: dark variants of health/loop/self, inbox, settings, new.
