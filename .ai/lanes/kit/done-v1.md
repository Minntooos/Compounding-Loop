# Kit lane: DONE

## Built
- `method/`: COMPOUNDING_LOOP, operating card (<60 lines), task template, knowledge index + example entry, reviewer prompt, stuck protocol, retro.
- `templates/static-site`, `templates/chrome-extension` (template `gitignore` renamed so npm ships it; core restores `.gitignore`).
- `runners/routine` (prompt + README), `runners/github-actions/loop.yml`, `runners/local/`.
- `plugin/` (4 commands) and the root `.claude-plugin/marketplace.json` (docs).

## Tests
`npm test` green on 2026-10-08: 219 unit passed (2 slow skipped), 30 e2e passed.

## Unsure
- Slow tests (LOOP_SLOW) not run this session.
- Chrome-extension has no icons.

## Next 10 improvements
1. Extension icons and a store-ready listing checklist.
2. A Next.js/Astro static template.
3. A CLI/npm-library template.
4. A Python template.
5. Placeholders for install/test commands in the routine prompt.
6. Per-lane prompt variants in runners/routine.
7. A GitHub Actions matrix example for multi-lane loops.
8. A launchd plist for macOS in runners/local.
9. More example knowledge entries.
10. A plugin command for the dashboard.
