# Memory: recipes and triggers

Learn once, one-shot the next. When a project or feature is finished, what it taught is kept in two small forms, and the next run starts from them instead of from zero:

- A **recipe** is the procedure: steps, traps and the checks that prove each step. It is one Markdown file, at most 6 KB.
- A **trigger** is a single lesson that fires at the moment it matters (a failing command, a file being edited, a word in your prompt).

The goal is the smallest context that still passes: one recipe plus the checks that prove it. Whether that really helps is measured, not claimed: see [Prove it with an eval](eval.md).

## Recipes

A recipe file has front matter and five sections, in this order. The blank template is `templates/recipe.md`; two seeds ship in `templates/recipes/` (`static-calculator-site`, `cli-command-json`).

```markdown
---
id: R-cli-command-json
title: Add a CLI subcommand with --json output and tests
kind: feature            # project | feature
stack: [node@20]         # name@major
tags: [cli, json]
status: CONFIRMED        # CONFIRMED | GUESS
source: owner/repo at commit abc1234
uses: 0
passes: 0
updated: 2026-10-14
---
## When to use
## Steps          (numbered; every step names the command or test that proves it)
## Traps          (one line each, with the knowledge id or trigger that covers it)
## Checks         (the commands that decide done)
## Start from     (templates or files to copy first)
```

Rules that keep a recipe useful: induce it only from work whose checks passed, never paste secrets, emails or absolute paths, and change an existing recipe by adding or editing items, not by regenerating the whole file (a full rewrite loses detail; this is the "context collapse" the ACE paper measured).

### Where recipes live

| Store | Path | For |
|---|---|---|
| Project | `.ai/recipes/` | Work done in this repo |
| User | `~/.ai/recipes/` | Your recipes across projects (set `LOOP_HOME` to use another folder) |

### Commands

```sh
npx compounding-loop recipe list                      # every recipe in both stores
npx compounding-loop recipe match "add a mortgage calculator page"   # top 3 for this repo
npx compounding-loop recipe show R-static-calculator-site --context  # exactly what a model receives
npx compounding-loop recipe check                     # lint every project recipe
npx compounding-loop recipe check path/to/file.md     # lint one file
npx compounding-loop recipe add path/to/file.md       # copy a passing recipe into .ai/recipes/ (--global for ~/.ai/recipes/)
npx compounding-loop recipe draft --print-prompt      # the prompt only, no Claude call
npx compounding-loop recipe draft                     # ask claude -p for a draft
```

Every command takes `--json`, and `--dir <dir>` to point at another repo.

- **match** reads your `package.json` dependencies at their major version and compares them with each recipe's `stack`; a major mismatch counts against it. Words in the task text are compared with the recipe's tags. It prints the score and the reason.
- **check** fails (exit 1, with a fix for each problem) on a missing field or section, a recipe over 6 KB, a step with no proof, or an absolute path, email or token-like string.
- **draft** builds a prompt from the finished work (`DONE.md`, the task file's Decisions, Tried and Don't, the knowledge entries and the run log) and writes `.ai/recipes/<id>.draft.md`, scored by `check`. **You** rename it to accept it. If the id already exists, the draft is a list of added or changed items, not a rewrite. `--print-prompt` is what the tests use.

At the end of a task the retro (method section 12) asks: "is this a procedure someone will repeat?" If yes, run `recipe draft`. A repeated procedure becomes a recipe; a repeated mistake still goes note, then trigger, then check.

## Triggers

Triggers live in `.ai/triggers.yaml`, a list of entries:

```yaml
- id: T-crlf-python
  on: command
  match: ["python", "python3"]
  inject: "On Windows, Python's open(path, 'w') writes CRLF. Write with newline=''."

- id: K-0002
  on: error
  match: ["EBUSY", "/timed out in \\d+ms/i"]
  inject: .ai/knowledge/K-0002.md
```

| `on` | Matches against | How |
|---|---|---|
| `error` | the output of a tool that failed | substring, or a `/regex/` |
| `file` | the path a tool reads or edits | glob |
| `command` | a Bash command, before it runs | prefix, or a `/regex/` |
| `topic` | your prompt | keyword |

`inject` is either the text itself or the path of a knowledge entry (its first 1,200 characters are used). One hook call injects at most 2,000 characters in total, and the same trigger is injected at most once per session. Bad entries are skipped and reported, never fatal.

### Hooks: how triggers reach the model

`loop hook <event>` is the entry point for Claude Code hooks. It reads the hook JSON from stdin and prints the context to inject (or nothing). It makes no network call and no model call, and it always exits 0, so a broken hook can never break a run.

| Event | What it does |
|---|---|
| `SessionStart` | one line naming the best matching recipe (nothing if none scores) |
| `UserPromptSubmit` | `topic` triggers |
| `PreToolUse` | `command` triggers, before a Bash command runs |
| `PostToolUse` | `file` triggers, after a tool succeeds |
| `PostToolUseFailure` | `error` and `file` triggers, after a tool fails |

Tool matchers are limited to the built-in tools (`Bash|Read|Edit|Write|Glob|Grep`); context for MCP and subagent tool calls is dropped by Claude Code.

There are two ways to switch the hooks on:

1. **The plugin.** `plugin/hooks/hooks.json` declares all five events, running `loop hook <event>` with a 5 s timeout. It needs `loop` on the `PATH`.
2. **Without the plugin.** `npx compounding-loop init --hooks` merges the same hooks into the project's `.claude/settings.json`, keeping your other settings.

`npx compounding-loop init` (which wants a brief, `IDEA.md`, or `--force`) always writes a starter `.ai/triggers.yaml` (comments only) and lists the seed recipes that match your repo; add `--recipes` to install them.

### Seeing what helped

Each fire is appended to `.ai/.trigger-log.jsonl` (local, gitignored).

```sh
npx compounding-loop triggers stats        # fired count per trigger id (--json too)
```

`loop runs log` can record how many triggers fired in a run. Whether a trigger *helped* is a judgement the retro makes by hand.

## Cleanup

Memory only helps while it is small and true.

- Delete a trigger that helps less than half the times it fires (the method's rule). Use the `stats` output to find the quiet ones.
- Mark a recipe `GUESS` until a run that followed it passed its checks; raise `uses` and `passes` as evidence comes in.
- Edit a recipe by items. If it grows toward 6 KB, move detail into a knowledge entry and keep the recipe as the short path.
- Nothing personal goes in the user store, and nothing from other people's projects without a compatible licence.
- The dashboard's **Knowledge & recipes** tab shows the index entries with their trigger counts and the recipes with their stacks, step counts and a copy button for the `show --context` command. See [Dashboard](dashboard.md).
