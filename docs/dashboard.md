# Dashboard tour

```sh
npx compounding-loop dashboard            # your projects
npx compounding-loop dashboard --demo     # five real builds, read-only
```

It serves on loopback only. Options: `--port N`, `--no-open`, `--projects dir`.

- **Fleet:** every loop with its state (running, needs you, done, failing), round, tests and last commit.
- **Loop detail:** tabs for the timeline, contract, knowledge, decisions and settings.
- **Inbox:** questions from `BLOCKED.md`. Keyboard: `j`/`k` to move, `a` to accept the suggested answer.
- **Health:** checks such as stale locks, a loop with no commit for two hours, or runs that end in seconds.
- **New loop wizard:** scores your brief live, picks a template and runner, and shows the exact command.
- **Lanes:** each lane's state, run N/LIMIT, last commit and any active claim by a teammate ([team workflow](team.md)).
- **Live demo:** the [hosted demo](https://minntooos.github.io/Compounding-Loop/) reads this repo's commits from GitHub in your browser. If GitHub's 60 requests per hour limit is hit, it falls back to a bundled snapshot; the header chip says Live or Snapshot.
- **Runs, Tests and Releases tabs:** for laned loops. Runs lists every scheduled run with its outcome (pushed, nothing pushed, tests failed, no run recorded) and warns when lanes stay silent; Tests shows the latest result, the last failure and a per-run chart; Releases shows the CHANGELOG entries.
- **Ready to ship:** a checklist on the loop page (the same checks as `loop ship-check`): round done (root `DONE.md`), no open blockers, a CHANGELOG entry, a free tag, a clean tree and passing tests.
- **Status strip:** one line at the top of every page: loop state (running, likely running, idle, sleeping, paused, done, release waiting), round, CI, usage-limit stops in the last 5 hours and the next lane due.
- **Needs you:** every item that waits on you is a row with its action inline: Review & release, answer a `BLOCKED.md` question (Answer locally, Edit on GitHub on the demo), or wake a stalled lane. The banner count and the Inbox come from the same list.
- **Heat map:** a lane × hour grid of the last 24 hours, one cell per expected run, coloured by outcome, with a legend. Outcomes are explained in [Steering](steering.md#what-the-dashboard-calls-a-run).
- **Settings:** light and dark theme.

## Controls

A laned loop's page has these buttons. Each asks first and says what it changes. The dashboard never holds a token.

| Button | What it opens | What it changes in the repo |
|---|---|---|
| **Pause all** / **Resume** | A confirm dialog with an optional reason. | Adds or removes `.ai/PAUSED` on `main`. While it exists every lane run and the control room replies "Paused" and stops. CLI: `loop pause` / `loop resume`. |
| **Start next round** | A dialog with a box for the new brief and its live score. The button works from a score of 60. | Adds `.ai/next-round.md` on `main`. The `next-round` workflow then puts the brief first in `IDEA.md`, archives the DONE files, resets each lane's `task.md` and deletes the file. CLI: `loop next-round --brief`. |
| **Steer** (key `S`) | A dialog: lane (and unit), *Next run* or *Standing*, your text, and the exact entry before saving. | Appends an entry to `.ai/lanes/<lane>/steer.md` and wakes the lane in `.ai/schedule.json`. CLI: `loop steer`. See [Steering](steering.md). |
| **Pause lane** / **Resume**, **Snooze until…**, **Wake now** | On each lane. Pause asks first; Snooze and Wake act at once and the opposite button undoes them. | Edits that lane's entry in `.ai/schedule.json`. CLI: `loop schedule`. |
| **Change pace** / **Save pace** | The four presets with what each skips, on the loop page and on each lane. | Writes `.ai/policy.json`. CLI: `loop pace set`. |
| **Draft with Claude** (in Start next round) | The ingredients (next-10 lists, open findings, steers), then the draft streams into the brief box. On the demo, **Copy prompt** for Claude Code instead. | Nothing until **Go**; the local draft uses your own `claude`. CLI: `loop next-round --draft`. |
| **Release** | The release workflow page on GitHub. | Nothing yet. Disabled, with the reason shown, until `ship-check` passes. You still press *Run workflow* and approve the `release` environment: see [Release](release.md). |

**On your machine** (`npx compounding-loop dashboard`) Pause, Resume, Steer, the schedule buttons, Pace and Start next round run through the local server and commit and push `main`. If the commit could not be pushed the dialog says "Committed in the <loop> folder but not pushed" and gives git's reason; run `git push` there, because lanes read `main` on GitHub. If **Start next round** fails after the loop already moved on, the dialog says "Round N may have started" and offers Close only, so it never starts a second round; check `git status` and `git log` in the loop folder first. **On the hosted demo** the buttons open a prefilled GitHub page that you submit yourself; nothing is sent from the dashboard. On the hosted demo, a loop with no GitHub repository cannot use them.

![Fleet screen](assets/screens/fleet-light-laptop.png)

Regenerate the screenshots with `npm run build && SCREENS=1 npx playwright test screenshots`.
