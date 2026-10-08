# Claude Code routine runner

A routine is a scheduled Claude Code session in the cloud. It runs `prompt.md` against your repository on a cron schedule, with nobody watching.

## Set up

1. Copy `prompt.md`. Its only placeholder is `{{name}}`, your project name. The install and test commands come from your `CLAUDE.md`.
2. In Claude Code on the web, create a routine for the repository and paste the prompt. Give it write access to `main` only.
3. Pick a schedule (see below). `loop` generates a staggered cron line for you.

## Staggered cron

If several loops (or several lanes of one project) run against one repository, give each a different minute so they do not collide. Use the pattern `M * * * *` (hourly), and move `M` by at least 10 minutes per loop, for example `7 * * * *`, `17 * * * *`, `27 * * * *`. Avoid minute `0`: everyone's schedule lands there.

Each run stops after about 40 minutes of work, so an hourly schedule leaves a gap before the next one. The 90-minute session lock (`.ai/session.lock`, or `.ai/lanes/<lane>/session.lock` per lane) stops two runs from working at once. The run budget (`Run: N / 30` in `.ai/task.md`) caps the total number of runs.

## Safety

The prompt never publishes, spends money or stores a secret. The routine uses your Claude account; no API key goes into the repository.

## Lanes

With several lanes, create one routine per lane plus one control room routine.

| File | Placeholders | Routine |
|---|---|---|
| `lane-prompt.md` | `{{name}}` project, `{{lane}}` lane name | one per lane, hourly |
| `control-room-prompt.md` | `{{name}}` project, `{{lanes}}` lane names, comma separated | one, every 3 hours |

`loop run --lane <name>` fills them for local runs. In the cloud, paste the filled text into the routine. In the cloud nothing writes the lock; it only matters when a local `loop run --lane` is active too. The lane prompt stands down on a fresh `.ai/lanes/<lane>/session.lock`, stops on root or lane `DONE.md`/`BLOCKED.md`, and ends every commit with `Lane: <lane>`.

### Staggered cron for N lanes

Give lane `i` (counting from 0) the minute `7 + i * step` with `step = 12` for up to five lanes (more lanes: use a smaller step, but keep minutes distinct), and put the control room on its own minute every 3 hours. Runs last up to 40 minutes, so neighbouring lanes overlap; that is expected. Path ownership plus `git pull --rebase` before each push make it safe, and the stagger only spreads the pulls out. Avoid minute 0.

3 lanes (`api`, `web`, `docs`):

| Routine | Cron |
|---|---|
| api | `7 * * * *` |
| web | `19 * * * *` |
| docs | `31 * * * *` |
| control room | `43 */3 * * *` |

5 lanes (`core`, `kit`, `server`, `web`, `docs`, as in this repository):

| Routine | Cron |
|---|---|
| core | `7 * * * *` |
| kit | `19 * * * *` |
| server | `31 * * * *` |
| web | `43 * * * *` |
| docs | `55 * * * *` |
| control room | `3 */3 * * *` |

Each lane run stops after about 40 minutes, so an hourly lane leaves a gap. Runs that end in about a second usually hit the plan's usage limit, not a bug; fewer or slower lanes cost less.
