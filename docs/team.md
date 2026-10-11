# Work on a loop with a teammate

A loop lives in a git repo, so a teammate needs nothing from you except the repo: their own Claude Code reads the brief, the lane task files and the outboxes from the clone. Nothing private is passed by hand. A claim file tells everyone (including scheduled runs) which lane is taken. This page assumes the repo already uses [lanes](lanes.md).

## 1. Clone

```sh
git clone https://github.com/<owner>/<repo>.git
cd <repo>
```

Make sure `git`, `claude` and `gh` work for you (`npx compounding-loop doctor` checks).

## 2. See what is open

```sh
npx compounding-loop next
```

This lists the open units of every lane with their claims, and recommends one nobody holds. Add `--json` for scripts. Inside a Claude Code session with the plugin, `/loop-next` does steps 2 to 5 for you.

## 3. Claim the lane

```sh
npx compounding-loop claim core --as Sam --minutes 90
```

This writes `.ai/lanes/core/claim` (one line: `Sam · expires <UTC time>`), commits it with the trailer `Lane: core` and pushes. `--as` defaults to `git config user.name`. If someone else holds an unexpired claim, the command refuses; `--force` takes the lane over. An expired claim counts as no claim. Scheduled runs that find an unexpired claim by someone else reply "Nothing to do" and stop, so you and the cloud routine do not edit the same lane.

## 4. Run the lane

```sh
npx compounding-loop run --lane core
```

This runs one round of Claude Code on the lane's task file, outbox and lock, with the same prompt the scheduler uses. Add `--dry-run` to read the prompt first. Edit only the paths the lane owns and end every commit with `Lane: core`; `npx compounding-loop check-lanes` verifies it.

## 5. Release

```sh
npx compounding-loop release core
```

This removes the claim, commits and pushes. If you forget, it expires by itself after the minutes you gave.

`loop status` and the dashboard show who holds which lane.
