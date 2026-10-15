# Prove it with an eval

A claim counts only when it is measured. `loop eval` rebuilds known tasks from scratch, once cold and once with a recipe, and reports pass rate, tokens and time. The headline number in the README comes from this report and from nothing else: no results file, no headline.

<!-- eval: pending -->
The owner's first real run has not been published yet, so this page documents the method, not a result.

## Tasks

A task is a folder in `evals/` (layout in `evals/README.md`):

| File | Purpose |
|---|---|
| `task.md` | The request a cold model gets |
| `repo/` | A tiny starting project with no npm dependencies (only Node's built-in `node --test`), so no network is needed |
| `verify/` | The check. It is copied in **after** the run, so the model cannot read or edit it |
| `solution/` | A reference patch, used by the fake runner |
| `eval.json` | The recipe id, the arms, the check (an argument array, never a shell string) and the turn limit |

Three tasks ship: `calc-page` (add a tested calculator page to a static site), `cli-json` (add a subcommand with `--json` to a small CLI) and `known-trap` (a change that hits a planted CRLF trap that a trigger covers). Each task's check is proven to discriminate: the untouched fixture fails it and fixture plus `solution/` passes.

## Arms

| Arm | The model gets |
|---|---|
| `cold` | `task.md` only |
| `recipe` | `task.md` plus `loop recipe show <id> --context` |
| `recipe+triggers` | the recipe, and the task's `triggers.yaml` wired as hooks in the temp repo |

`--arm both` (the default) runs cold and recipe; `--arm all` adds recipe+triggers where a task has triggers.

## Running it

Every run copies `repo/` into a fresh temp folder, runs `git init`, calls `claude -p <prompt> --output-format json --max-turns 30` there with tools limited to file edits plus `node`, `npm test` and `npm run`, then runs the check. Your own repo is never touched. The exact command is printed first.

```sh
npx compounding-loop eval run --runner fake --task calc-page       # free: applies solution/, saves nothing
npx compounding-loop eval run --runner fake --fake-mode nothing    # free: the checks must fail
npx compounding-loop eval run --runner claude --model haiku --runs 3   # real: spends your Claude usage
npx compounding-loop eval report                                   # the table and the headline
```

`--runner fake` is how to check your setup. It makes no model call and no network call. `--runner claude` spends your plan's usage, so start with one task and `--runs 1`. Scheduled lane runs never use it; the owner runs it locally.

Results append to `evals/results/<date>-<model>.jsonl`, one line per run: pass, input, output and cache tokens, cost, duration and turns.

## Reading the report

`eval report` prints one row per task × arm × model: passes out of runs, median tokens, median seconds and median turns. Under it is one sentence built from those rows, for example "Haiku: 3/3 with a recipe vs 1/3 cold, 58% fewer tokens" (an illustration of the format, not a result). Use `--json` for rows and headline.

Read it with care: three tasks and a few runs each is a small sample. A pass-rate gap is only meaningful if the cold arm fails for a reason the recipe addresses, so open a failed run's temp copy before believing the number.

## Local models through Ollama

> **Unverified until the owner's run.** Ollama exposes an Anthropic-compatible API, so Claude Code can be pointed at it with environment variables. We have not yet measured a local model with this eval.

Put the variables in a file (so they stay out of your shell history) and pass it with `--env-file`; the values are never printed:

```
ANTHROPIC_BASE_URL=http://localhost:11434
ANTHROPIC_AUTH_TOKEN=ollama
ANTHROPIC_API_KEY=
ANTHROPIC_DEFAULT_HAIKU_MODEL=<your local model>
ANTHROPIC_DEFAULT_SONNET_MODEL=<your local model>
ANTHROPIC_DEFAULT_OPUS_MODEL=<your local model>
```

```sh
npx compounding-loop eval run --runner claude --env-file local.env --model <your local model> --runs 3
```

The model needs tool calling and a context window of at least 64k.

### Hardware honesty

A local model is limited by your memory. As a rule of thumb, a 6 GB GPU fits only small models, which may be slow, may fail tool calls and may not fit a 64k context. If the cold arm fails every time on a small model, that is itself the point of the recipe arm, but report it as measured on your hardware, not as a general claim.
