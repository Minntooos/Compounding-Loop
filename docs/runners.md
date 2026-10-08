# Runners

A runner wakes the loop on a schedule. All three use the same prompt (`runners/routine/prompt.md`) and respect `DONE.md`, `BLOCKED.md` and the session lock.

## Claude Code routine
A scheduled cloud run. Copy the prompt from `runners/routine/prompt.md`, attach your repo and pick an hourly or similar schedule. Cloud sandboxes clone fresh each time, which avoids stale checkouts.

## GitHub Actions
Copy `runners/github-actions/loop.yml` into `.github/workflows/`. Store your Claude credentials in repository secrets yourself; this project never asks for or stores them.

## Local
Run `npx compounding-loop run` from cron, launchd or Task Scheduler. Your machine must be awake and logged in to Claude Code. `loop run` checks for `DONE.md` and `BLOCKED.md` before starting.

Local scheduler examples: `runners/local/` (crontab, Windows Task Scheduler).
