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
| 5 | Lanes UI | Built (LanesTab, LaneStrip, Needs-you counts) with e2e on fixtures and on the demo's sixth loop. | ok |
| 6 | Settings | Already wired to `GET /api/settings` with an e2e (`screens.spec.ts`: "settings shows the server settings"). Unit 3 is done. | ok |
| 7 | 375 px and motion | `tests/e2e/layout.spec.ts` asserts no horizontal overflow at 375 px on all screens incl. the laned loop; `index.css` honours `prefers-reduced-motion`. Screenshots in `docs/assets/screens/`. | ok |
| 8 | Not yet judged | Long names/paths and empty/loading states by eye: still to do in the polish pass. | open (planned) |
