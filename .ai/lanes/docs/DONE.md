# Docs lane: done

## Built
README (pitch, screenshot, proof table from the five-site data, Mermaid diagram, honest comparison, FAQ); `docs/` (getting started, concepts, runners, dashboard, templates, FAQ, troubleshooting); CONTRIBUTING, CODE_OF_CONDUCT (Contributor Covenant 2.1, attributed), SECURITY, CHANGELOG; issue and PR templates; CI workflow; manual-only demo Pages workflow; `.claude-plugin/marketplace.json`; `launch/` drafts (Show HN, X, Reddit, dev.to, LinkedIn, five good first issues) and the social preview SVG + 1280x640 PNG.
`npm run check` verifies the README install command, proof table and every relative link in README and `docs/*.md`.

## Tests
`npm test` green at the last push (check, typecheck, 208 unit, build, 30 e2e).

## Unsure
- `npx compounding-loop init` fails until the owner publishes the package.
- Repo links use `Minntooos/compounding-loop`; the owner renames before launch.
- The Contributor Covenant text is condensed, not verbatim.
- Elapsed hours in the proof table are first-to-last commit, not human time.
- The demo Pages workflow is untested (needs Pages enabled).

## Next 10 improvements
1. A 15-second GIF of the dashboard for the README.
2. Verbatim Contributor Covenant 2.1 text.
3. Test the Pages workflow and link the live demo from the README.
4. Fill the dev.to article's "what I would do differently" with the owner's notes.
5. Dark-mode screenshot and a Loop detail screenshot in `docs/dashboard.md`.
6. Auto-check that docs flags match `loop --help` output.
7. Add docs for the Claude Code plugin commands.
8. Real troubleshooting entries with exact error text.
9. Release workflow draft (manual) for npm provenance.
10. Translate the README quick start.
