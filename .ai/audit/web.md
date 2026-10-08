# Audit: web (round 2, 2026-10-08)

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
| 5 | Lanes UI | Not built yet: the demo has no sixth (laned) loop and no lane fields in `src/core/types.ts`. Waiting on server/core data shape (unit 4). | open (planned) |
| 6 | Settings | Already wired to `GET /api/settings` with an e2e (`screens.spec.ts`: "settings shows the server settings"). Unit 3 is done. | ok |
| 7 | Not yet judged | 2-second "needs me?" test, focus order by hand, 375 px layout, reduced motion, long names/paths, loading and empty states: covered in the unit 5 polish pass with screenshots. | open (planned) |
