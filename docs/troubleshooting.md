# Troubleshooting

## The five-hour limit
Claude Code plans have usage windows. Runs that hit the limit end early without finishing a unit. The dashboard health check flags three runs in a row that last under five seconds. Space your schedule out, or lower how often it fires, and let the window reset.

## Stale sandbox clones
A cloud run works on a fresh clone made when it starts. If another run pushed in the meantime, your push is rejected. The run should `git pull --rebase` and push again. A local clone that has not pulled can look green while `main` is red, so always pull first.

## Blocked pushes
If pushes to `main` are refused by permissions or branch protection, the loop records it under Tried and pushes to a side branch. Allow the runner to push, or merge the branch yourself.

## A run seems to do nothing
Check for `DONE.md`, `BLOCKED.md` or a fresh `.ai/session.lock` (under 90 minutes old). Any of them makes a run stop immediately.

## Browser tests cannot launch Chrome
Run `npx playwright install-deps chromium`, or set up a system Chrome as described in `playwright.config.ts`.
