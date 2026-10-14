# Eval tasks

Each folder is one task for `loop eval`. The fixtures need no network and no npm packages: they use Node's built-in `node --test`.

| File | What it is |
|---|---|
| `task.md` | The request a cold model receives |
| `repo/` | The starting project (zero dependencies) |
| `verify/` | The check. Copied into the working copy **after** the run, so the model cannot edit it |
| `solution/` | Files laid over `repo/` for a reference run (the fake runner) |
| `eval.json` | `id`, `title`, `task`, `recipe` (id), optional `recipeFile` (path inside the task folder, for a recipe that is not a shipped seed in `templates/recipes/`), optional `triggers` (a `triggers.yaml` for the triggers arm), `arms`, `check` (an argument array run in the working copy, never a shell string) and `maxTurns` |

Every task is proven to **discriminate**: `tests/unit/kit/evals.test.ts` runs the check on the untouched fixture (it must fail) and on the fixture plus `solution/` (it must pass).

Never run these against a real model from a scheduled lane. The owner runs `loop eval run --runner claude` locally.
