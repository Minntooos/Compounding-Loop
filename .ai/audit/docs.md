# Audit: docs

## Round 4 (2026-10-11, 0.4.0 "Control")
Goal judged: the owner releases and starts rounds from GitHub buttons with no token in chat; every dashboard control has a page that says what it changes.

### Blockers
None open.

### Findings
| # | Area | Evidence | Severity | One-line fix |
|---|---|---|---|---|
| 1 | Release path | No `release.yml`; 0.3.0 was never published and tokens were pasted into chat. | major | `release.yml` (OIDC, `environment: release`, dry-run input) + `docs/release.md`: done in run 1. |
| 2 | Next round | No `next-round.yml`; `loop next-round --brief --no-commit` exists in core. | major | Workflow added in run 1; tests parse both workflows (`tests/unit/docs/workflows.test.ts`). |
| 3 | Ship check in CI | `loop ship-check` needs a test result from a run-log line or `.ai/last-test.json`; nothing writes the latter, so a release relies on the lanes' logged runs. | minor | Note in docs/release.md if it bites; core owns the writer. |
| 4 | Dashboard page | `docs/dashboard.md` does not cover Pause, Next round, Release or Ready to ship; web has not shipped them yet. | major (waiting) | Write it from web's real buttons once they land; no unshipped feature is described. |
| 5 | actionlint | Not installed here and CI has no network step for it. | minor | Structure test instead (allowed by the brief). |

Cross-lane: none new.

## Round 3 (2026-10-11, 0.3.0 "Showcase")
Goal judged: a visitor understands the product from the README's first screen and can watch the repo build itself; a teammate joins with one page.

### Blockers
None open.

### Findings
| # | Area | Evidence | Severity | One-line fix |
|---|---|---|---|---|
| 1 | README first screen | `README.md:5-13`: the tagline and `npx compounding-loop init` come first; the live demo is one line after the badges and says "the five-site data", but the demo now shows six loops and will go live. | major | Lead with "Watch this repo build itself" + demo link once live mode ships (unit 3). |
| 2 | Screenshots | README uses `docs/assets/screens/*` from round 2; `web/DESIGN.md` exists but redesigned screens are not in yet. | major | Re-shoot after web ships (`SCREENS=1 npx playwright test screenshots`), unit 3. |
| 3 | Teams | No `docs/team.md`; `loop next/claim/release` are not in `loop --help`, so the docs-vs-`--help` check (check 7) would fail on them. | major | Write `docs/team.md` after core lands the commands (unit 2). No unshipped feature is described until then. |
| 4 | Rate limits | README and `docs/faq.md` say nothing about GitHub's 60 requests/hour limit or the snapshot fallback. | major | FAQ line once live mode exists (unit 3). |
| 5 | Pages workflow | `.github/workflows/demo-pages.yml` paths omit `src/core/**`; the live demo will import core parsers. | major | Add `src/core/**` (done in this run). |
| 6 | Launch drafts | `launch/*.md` still lead with the 0.2.0 lanes story, not the live self-build. | minor | Rewrite in unit 4 once the demo is live. |
| 7 | Repo URL casing | Earlier fixed; `grep -ri 'minntooos/compounding-loop'` over README, docs and launch finds none with the old casing. | ok | none |

Cross-lane: nothing for other lanes yet. Docs waits on core (`loop next/claim/release`) and web (new screenshots, live indicator) before units 2-4 can state anything as shipped.

## Round 2 (2026-10-08)

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

## Fresh-install test (round 3, 2026-10-11, docs run 3)
From `npm pack` (0.2.0 tarball) installed into an empty temp dir:
- README quick start: `new static-site my-site` creates the repo; `run --dry-run` prints the prompt. PASS (`dashboard` not opened: needs a browser).
- docs/team.md in a cloned repo with a bare remote: `init --lanes core,web` (after a brief that passes the score), `next` (recommends core unit 1), `claim core --as Sam --minutes 90` (commits and pushes), a second `claim core --as Bo` refuses, `run --lane core --dry-run` prints the lane prompt, `release core`, `check-lanes` clean. PASS.
- Finding (minor, documented): `init` refuses a thin IDEA.md ("No checkable done-when…"). README already says a brief is needed; no change.

## Fresh-install test (round 4, 2026-10-11, docs run 3)
From `npm pack` (tarball 0.3.0) installed into an empty temp dir, repo cloned from a bare remote:
- `init --lanes core,web` (needs `--force` for my short test brief), `pause --reason` writes `.ai/PAUSED`, commits and pushes; `resume` removes it and pushes. PASS.
- `runs` lists the missed slots as "no run recorded"; `next-round --brief b.md --no-commit --dry-run` prints the plan (IDEA.md, both task files, control-room note, deletes the brief); `ship-check` prints the six items and "Not ready to ship". PASS.
- Findings (minor): `pause`/`resume`/`runs`/`ship-check` take no dir argument and use the cwd (docs/dashboard.md and release.md already say `loop pause`, no dir). A brief with a "Must have:" heading plus three bullets still scored too thin for `init`; not investigated (core's scorer).
- Not run: release.yml dry run (needs GitHub), `dashboard` (needs a browser).
