# Audit: web

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
