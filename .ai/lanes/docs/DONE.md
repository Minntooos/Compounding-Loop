# Docs lane: DONE (round 2)

## Built
README with the lanes story, proof table, sourced comparison table and FAQ; docs/lanes.md, getting-started and plugin commands; docs-vs-`--help` check (check 7, subcommand aware); launch/ rewritten with objections sections; CHANGELOG 0.2.0 list; blocking CI lane-ownership step (per push/PR range); two fresh-install tests in .ai/audit/docs.md.

## Tests
`npm test` green on 2026-10-11 before the final docs-only edits (90 e2e passed); `npm run check` run after.

## Unsure
- Version stays 0.1.0 by instruction; the install test used the 0.1.0 tarball.
- `check-lanes` on an empty repo gives a raw git error (reported to core).

## Next 10 (by value)
1. Re-run the fresh-install test from the published npm package once released.
2. Record a 60 s terminal demo GIF for the README.
3. Add a Windows `claude.cmd` setup note once verified on a real machine.
4. Check external links in CI weekly.
5. Auto-refresh README screenshots from `SCREENS=1` in release prep.
6. A troubleshooting page keyed by error text from `loop doctor`.
7. Cost guide with real plan-usage numbers from the five sites.
8. docs/cookbook: a lane for a monorepo, a docs-only loop.
9. Translate README quick start (es, de).
10. Generate the CLI reference from `--help` instead of hand-writing it.
