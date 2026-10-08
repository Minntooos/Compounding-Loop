# Getting started

You need Node 20 or newer and [Claude Code](https://claude.com/claude-code).

## 1. Create or adopt a repo

New project from a template:

```sh
npx compounding-loop new static-site my-site
```

Existing repo:

```sh
cd my-repo
npx compounding-loop init
```

`init` is idempotent. It merges the Operating Card into `CLAUDE.md` between markers, adds `.ai/method.md`, a task template and a knowledge index, and never overwrites a file unless you pass `--force`.

## 2. Write the brief

Fill in `.ai/task.md`: goal, done-when (each item a command that exits 0), constraints and out of scope. The dashboard wizard scores your brief and lists the gaps. See [Concepts](concepts.md#task-contract).

## 3. Run a round

```sh
npx compounding-loop run
```

This runs one round with Claude Code using the same prompt a scheduler uses. Use `--dry-run` to see the command without running it.

## 4. Schedule it

Pick a runner in [Runners](runners.md): a Claude Code routine, a GitHub Action or a local cron.

## 5. Watch and answer

```sh
npx compounding-loop status          # fleet table in the terminal
npx compounding-loop dashboard       # local dashboard
npx compounding-loop answer          # answer a BLOCKED.md
npx compounding-loop next-round      # after DONE.md, start the next round
```

Run `npx compounding-loop dashboard --demo` to explore with the five real builds before you set anything up.
