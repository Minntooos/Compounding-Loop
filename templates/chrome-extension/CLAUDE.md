# CLAUDE.md

## Project core

**What this is:** a Chrome extension (Manifest V3) built by an unattended AI loop. The goal and must-haves are in [IDEA.md](IDEA.md).

**Commands**
- Install: `npm install`, then `npx playwright install chromium`. If the download is blocked, `playwright.config.js` finds a preinstalled Chromium or system Chrome.
- Test (the only judge of "done"): `npm test` = `check` + the Playwright extension test.
- Fast: `npm run check` (manifest, permissions, MV3 rules; no browser).

**Hard rules**
- All extension files live in `extension/`. No inline scripts or handlers (MV3 blocks them) and no remotely hosted code.
- Narrowest permissions only. Anything beyond those listed in IDEA.md needs the owner.
- Service workers stop when idle: keep state in `chrome.storage`, never in module variables.
- Every must-have in IDEA.md gets a Playwright test in `tests/` that loads the unpacked extension.
- No telemetry, analytics, ads or calls home. No secrets in the repository.
- Never publish to the Chrome Web Store, spend money or create accounts.
