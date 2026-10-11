# Lanes

A lane is one scheduled run that owns one part of the codebase. Several lanes push to the same `main` without merge conflicts because each edits only its own paths. This repo is built that way: five lanes (core, kit, server, web, docs), see [`.ai/lanes.json`](../.ai/lanes.json).

## Set up

Run this in a repo that has an `IDEA.md` brief (in a new repo, `npx compounding-loop new` writes one). `init` refuses a missing or thin brief; `--force` skips that check.

```sh
npx compounding-loop init --lanes core,web,docs
```

This writes `.ai/lanes.json` and, per lane, `.ai/lanes/<lane>/task.md` and `.ai/lanes/<lane>/outbox.md`. It also writes `.ai/control-room.md` and a lane section in `CLAUDE.md`/`AGENTS.md`. Then edit `.ai/lanes.json` so each lane's `owns` globs are right. Add a lane later with:

```sh
npx compounding-loop lanes add api --owns "src/api/**" "tests/api/**"
```

`--cron` sets its schedule; the default is the next staggered hourly minute.

## Ownership

A lane edits only paths matching its `owns` globs. Files under `shared` in `.ai/lanes.json` (lockfiles, configs) can be edited by any lane with the smallest possible change. Every lane commit ends with a trailer line:

```
Lane: docs
```

`loop check-lanes` reads the trailers and fails any commit that touched a file outside its lane. Commits without a trailer are reported but do not fail; merge commits are ignored.

```sh
npx compounding-loop check-lanes --range origin/main~20..HEAD
```

## Talking between lanes

- **Outbox:** each lane writes only to its own `.ai/lanes/<lane>/outbox.md`, newest first: `YYYY-MM-DD HH:MM UTC · to <lane|all> · message`. Every run reads the other lanes' outboxes first.
- **Control room:** `.ai/control-room.md` holds notes from a supervising routine (see below). Lanes read it at the start of each run.
- **Unanswered messages:** `loop status` and the dashboard Lanes tab show a message to a lane that has had no later outbox entry or commit from it.

## Running lanes

```sh
npx compounding-loop run --lane core
```

This uses the lane's own task file, outbox and session lock (`.ai/lanes/<lane>/session.lock`). For the cloud, create one routine per lane from `runners/routine/lane-prompt.md` plus one control-room routine from `control-room-prompt.md`; see [Runners](runners.md).

## Staggered cron

Give each lane a different minute, at least 10 apart (`7 * * * *`, `19 * * * *`, ...), and avoid minute 0. Lanes still stand down if a fresh lock exists, so an overlap wastes a run rather than corrupting files.

## check-lanes in CI

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0   # a shallow clone skips the oldest commit
- run: npx compounding-loop check-lanes --range origin/main~20..HEAD
```

`templates/lanes/ci-check-lanes.yml` and `runners/github-actions/lanes.yml` are ready-made versions.

## Troubleshooting

- **`check-lanes` reports a violation:** the commit touched a file its lane does not own. Move the change to the owning lane's outbox as a request, or add the path to `shared` if every lane may edit it.
- **A lane shows `stalled`:** no lock or commit for two hours. Check its cron and `loop doctor`.
- **A lane shows `blocked`:** it wrote `BLOCKED.md`. Answer with `loop answer` or the dashboard inbox.
- **A lane stands down immediately:** a fresh `session.lock` exists. Delete a stale one after 90 minutes.
