# Claude Code routine runner

A routine is a scheduled Claude Code session in the cloud. It runs `prompt.md` against your repository on a cron schedule, with nobody watching.

## Set up

1. Copy `prompt.md`. Its only placeholder is `{{name}}`, your project name. The install and test commands come from your `CLAUDE.md`.
2. In Claude Code on the web, create a routine for the repository and paste the prompt. Give it write access to `main` only.
3. Pick a schedule (see below). `loop` generates a staggered cron line for you.

## Staggered cron

If several loops (or several lanes of one project) run against one repository, give each a different minute so they do not collide. Use the pattern `M * * * *` (hourly), and move `M` by at least 10 minutes per loop, for example `7 * * * *`, `17 * * * *`, `27 * * * *`. Avoid minute `0`: everyone's schedule lands there.

Each run stops after about 40 minutes of work, so an hourly schedule leaves a gap before the next one. The 90-minute session lock (`.ai/session.lock`) stops two runs from working at once. The run budget (`Run: N / 30` in `.ai/task.md`) caps the total number of runs.

## Safety

The prompt never publishes, spends money or stores a secret. The routine uses your Claude account; no API key goes into the repository.
