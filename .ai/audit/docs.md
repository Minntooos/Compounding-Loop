# Audit: docs (round 2, 2026-10-08)

## Blockers
None open.

## Fresh-install test #1 (before the 0.2.0 docs rework)
Commands, run in an empty temp dir:
```
npm pack                                   -> compounding-loop-0.1.0.tgz (125 files)
npm init -y && npm i ../compounding-loop-0.1.0.tgz   -> added 10 packages, 0 vulnerabilities
npx compounding-loop --version             -> 0.1.0
npx compounding-loop new static-site my-site --dry-run   -> Created .../my-site (.gitignore, .ai/, CLAUDE.md, scripts/, tests/, site/ present)
cd my-site && npx compounding-loop run --dry-run         -> prints the routine prompt, "Nothing needs you."
npx compounding-loop status                -> my-site . waiting round 1 run 0/30
npx compounding-loop dashboard --no-open --port 4999     -> Dashboard: http://127.0.0.1:4999
```
Result: every README quick-start command works from the tarball. `.gitignore` survives packing.

## Findings
| # | Area | Result | Severity |
|---|---|---|---|
| 1 | Docs vs `--help` | New check 7 in `scripts/check.mjs` fails on any `loop <cmd> --flag` in README, docs/ or launch/ that `loop <cmd> --help` lacks (verified with a bogus flag). Current docs pass. | ok |
| 2 | Lanes | `init --lanes`, `check-lanes` and plugin commands are not in `--help` yet (core/kit). README and docs/lanes.md wait for them; no unshipped feature is described. | open (waiting) |
| 3 | README | No lanes story, no comparison with other tools, FAQ lacks the five required questions. Units 3-4. | open (planned) |
| 4 | Screenshots | `docs/assets/screens/` (24 images) from web are current; README still uses `docs/assets/dashboard.png`. | open (planned) |
| 5 | Launch drafts | Still the 0.1.0 story; rewrite is unit 6. No hype words found in the current drafts. | open (planned) |
| 6 | Repo URL casing | README badges use `Minntooos/compounding-loop`; canonical is `Minntooos/Compounding-Loop`. Cosmetic, fixed in unit 3. | minor |

## Fresh-install test #2 (2026-10-11, tarball 0.1.0 from `npm pack`)
```
npm i ./compounding-loop-0.1.0.tgz           -> found 0 vulnerabilities
npx compounding-loop --version               -> 0.1.0
npx compounding-loop new static-site my-site --dry-run -> Created my-site (.ai, CLAUDE.md, scripts, ...)
cd my-site && npx compounding-loop run --dry-run       -> prints the routine prompt
npx compounding-loop init --lanes core,web,docs        -> refused: "IDEA.md is missing" (needs a real brief or --force)
  ... --force                                          -> lanes.json, per-lane task/outbox, control-room written
npx compounding-loop run --lane core --dry-run         -> prints the lane prompt
npx compounding-loop dashboard --no-open --port 4998   -> Dashboard: http://127.0.0.1:4998
```
Failure found and fixed (docs): README and docs/lanes.md did not say `init --lanes` needs an `IDEA.md` brief; both now do.
For core (outbox): `check-lanes` in a repo with no commits prints a raw git error instead of "no commits yet".
