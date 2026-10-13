# Audit: web

## Round 5 (2026-10-13): the cockpit (glance, steer, sleep)

Method: read IDEA.md Round 5 A and C against `web/src` on a fresh pull (`npm test` green: 144 e2e passed, 30 skipped by design), starting from the afa659e design review and the owner's P0 list. Judged as a senior product designer would: can the owner answer the five 5-second questions (anything need me? running or stalled? limit stops? CI? ready to ship?) from the home screen alone? Today: no. The fleet card answers "needs you" and CI only; "running", "limit stops" and "shipped" are not shown anywhere at a glance, and there is no way to steer without a chat.

### Blockers
| # | Finding | Evidence | Fix |
|---|---|---|---|
| R5-1 | A4: the banner says 2 while the Inbox badge says 1. A release that is waiting is an inbox item (`kind: 'release'`) **and** adds 1 again through `releaseWaiting` | `web/src/lib/lanes.ts` `needsYouCount` (only blocked lanes are de-duplicated); `web/src/App.tsx` badge = `inbox.length` | one `attentionItems(loops, inbox)` list; banner, nav badge and (later) the status strip and Needs-you rows all read it |
| R5-2 | A1: a shipped release still reads "waiting on you": `releaseWaiting` is true for any done laned loop, ignoring server's new `LoopSummary.shipped` | `lanes.ts releaseWaiting` | shipped → "0.4.0 released <date>" on the card, no attention item |
| R5-3 | A3: Health shows "OK" for checks that were never measured (two states only) | `web/src/components/Health.tsx` `c.ok ? 'OK' : 'Failing'` | three states pass / fail / not checked (grey + how to check); needs a "not measured" signal from server (`HealthCheck.ok` is boolean): ask server, derive from `proof`/`reason` until then |
| R5-4 | No cockpit: no status strip (C1), no Needs-you rows with inline actions (C2), no heat map (C3), no steer composer (C4), no schedule controls (C5), no Draft-with-Claude stream, ingredients or Copy prompt in Next round (C6) | `web/src` has none of them | units 3-6; C8: DESIGN.md first and an independent design-review verdict per unit, recorded below |

### Major
| # | Finding | Evidence | Fix |
|---|---|---|---|
| R5-5 | A4: Tests tab prints "Sun 11 Oct 14:53 UTC UTC" | `TestsTab.tsx` `stamp` appends " UTC" to `timeUtc` (`web/src/lib/timeline.ts`), which already ends in " UTC" | drop the second suffix; unit test on the stamp |
| R5-6 | A6: at 375 px the main nav and the loop tab bar are clipped mid-word ("Settin", "Contrac") with no hint that they scroll; the active tab can sit off screen | `App.tsx` nav and `LoopDetail.tsx` tablist: `overflow-x-auto`, no fade, no `scrollIntoView` | edge fade while more content exists, active tab scrolled into view; e2e asserts every tab label is fully visible or reachable and the active one in view |
| R5-7 | A8: the loop header repeats the round ("Round 5/5" next to the card's round label) and shows "Round N/M" instead of server's `roundLabel` | `LoopDetail.tsx:90` | show `roundLabel` once |
| R5-8 | A8: "Release is off: Tests pass: no result" (two colons in one sentence) | `web/src/lib/controls.ts releaseBlocker` returns `label: detail` and `ControlBar.tsx:92` prefixes "Release is off:" | "Release is off until <label lower> (<detail>)." |
| R5-9 | A7: verify only. `cardFacts` already renders CI, tests and live site whenever the summary has them, in any mode; the gap was server data, which server filled locally (outbox 02:40) | `web/src/lib/card.ts` `cardFacts`, `Fleet.tsx` | regression e2e on a local-mode fixture with `ci`/`tests`/`demoUrl` |
| R5-10 | C7: Releases list shows CHANGELOG only; no tag or npm state, and "Ready to ship" shows even when shipped | `ReleasesTab.tsx`, `ShipPanel.tsx` | tag + npm chips per version (server's `LoopRelease.tag/npm`), hide Ready-to-ship once `shipped` |

**Status (run 1):** R5-1, R5-2, R5-5, R5-7, R5-8 fixed with tests. `tests/e2e/attention.spec.ts` failed on the old code (banner/badge 2 vs 1, shipped still waiting) and passes now; unit tests for `attentionItems`, `releasedText`, `headerRound`, `testStamp`, `releaseBlocker`. R5-10 fixed in run 1 (Releases tag/npm chips, shipped replaces Ready to ship and Release; lanes.spec.ts). R5-6 fixed in run 1 too (`tests/e2e/phone-tabs.spec.ts` failed before: Settings cut at 375 px with no fade). Open: R5-3 (waits on server's state field), R5-4, R5-9 e2e.

### C8 design review, run 3 (C4 steer composer)
Independent reviewer subagent, local-mode screenshots at 1440 and 375 px, both themes: home, loop page, Steer dialog with text, Lanes tab. (The demo snapshot has no laned loop, so demo mode was covered by `tests/e2e/steer.spec.ts` instead.)
Five questions from home: needs me **yes**; running or stalled **partly** (self card "Done" vs "round 4 is running now": server's snapshot fixture, open from run 2); limit stops **yes** ("not checked"); CI **yes**; ready to ship **partly** (strip says Release waiting; the Ship segment needs `ship` in the snapshot).
Fixed after review: the modal dialogs were pinned top-left by preflight's `margin:0` (also the control dialog) → `dialog:modal` centred, viewport-capped with scrolling, darker backdrop (e2e asserts centred and the buttons in view at 375 px); sticky button row; Steer buttons gained the ship-wheel icon; local preview author reads "<your git user.name>". A code reviewer also found: demo repos without steer.md 404 on the editor → "Create it with this entry" new-file link; the command uses POSIX single quotes and `--` (checked against a scratch repo).
Open: loop-page strip wraps to 3 lines at 375 px with a leading "·" (from run 2's strip, next unit); "Settings" nav label faint fade at 375 px (A6 fade exists, reviewer finds it faint).

### C8 design review, run 2 (C1 strip + C2 Needs-you rows; also run 1's Inbox rows, tab fade, release chips)
Independent reviewer subagent (wrote none of the code), screenshots at 1440 and 375 px in both themes: demo fleet, a routed 4-loop fleet (question, failing, stalled lane, waiting release), loop page, Inbox.
Five questions from the home screen: needs me **yes** (strip "4 need you", heading, badge and Inbox agree: checklist 18 passes); running or stalled **partly** (Stalled is clear; "Running" needs server's run outcomes, B3/A2); limit stops **yes, reads as unknown** ("Limit stops not checked"); CI **yes** ("CI failing · red"); ready to ship **partly** (busy fleet "Not ready · …"; demo has no ship data).
Fixed after review: Ship reads "Not ready · failing check: <label>"; CI on part of the fleet says "1 not checked"; a released version reads "0.4.0 released 13 Oct · <loop>" and only when one loop shipped; phone strip shortens CI/limits/ship so it stays on two lines; strip is `role="status"`; Inbox waits for the loops before listing rows (A4 while loading); demo blocked-lane rows open that lane's BLOCKED.md on GitHub.
Open (not web's data): reviewer "blockers" both come from the bundled round-3 snapshot (self card "round 4 is running now" while Done, no `ship` so Release is off while the strip says Release waiting): server's new demo fixtures (outbox). Local *Wake* waits on server's `POST …/schedule` (C5); limit stops, Running/Sleeping and "all lanes sleeping" wait on server's classified runs (A2/B3) — asked in outbox. Fixed in run 2 too: a 60 s re-render tick for "Likely running" (cockpit.spec.ts clock test). Minor, later: the loop-page "N need you" link opens the whole Inbox.

### Minor
- Live mode does not fetch npm yet (server outbox 02:40: `npmPackageUrl(packageName(...))` → `buildLiveLoop({npm})`); the static CSP already allows the registry (`src/server/static-export.ts` `LIVE_CONNECT_HOSTS`).
- Live Releases: if the tag-list request fails but the exact `v<version>` lookup works, or a repo has more than 100 tags, older rows show "No tag" (server's `annotateReleases` turns missing into false; asked server, outbox 02:15).
- The demo has no run-log, schedule or steer fixtures yet (server unit 3); web uses Playwright-routed fixtures until then.
- Phantom "no run recorded" slots (A2) are core/server's classifier; web only renders the outcome it gets.
- A5 (proj2 "round 6/6" from a handoff `done-v5.md`) is server's round count and A9 (brief score) is core's `lintBrief`; web only displays both. Sent to their outboxes (web outbox 01:50).

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
