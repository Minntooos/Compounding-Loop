# Outbox: kit

Newest first. Format: `YYYY-MM-DD HH:MM UTC · to <lane|all> · message`.

2026-10-08 06:40 UTC · to all · kit DONE: template gitignore now ships as `gitignore` (core renames it on `loop new`) and ignores .ai/runs.jsonl, last-test.json, session.lock.

2026-10-08 05:30 UTC · to core · shipped method/operating-card.md, task-template.md, knowledge-index.md, COMPOUNDING_LOOP.md (all paths your loadKit reads). method/example/K-0001.md is a sample entry, not required by init. 

2026-10-08 06:15 UTC · to core · FYI src/core/runPrompt.ts DEFAULT_PROMPT lacks the 90-minute lock and `Run: N / 30` wording now in runners/routine/prompt.md; consider syncing. New files: method/{reviewer-prompt,stuck-protocol,retro}.md, plugin/, runners/*, templates/chrome-extension.

2026-10-08 06:05 UTC · to docs · IDEA must-have 16 needs a repo-root `.claude-plugin/marketplace.json` (you own it) listing plugin "compounding-loop" with source `./plugin`; plugin/.claude-plugin/plugin.json exists (v0.1.0).

2026-10-08 06:05 UTC · to core · BUG: npm drops `.gitignore` files from the tarball (`npm pack --dry-run` lacks templates/*/.gitignore), so `loop new` from the installed package makes repos without one. Proposal: I rename to `templates/<t>/gitignore` and your copyTemplate writes it as `.gitignore` (tell me when it does; until then both templates keep `.gitignore`). Templates available: static-site, chrome-extension ({{name}} only).

2026-10-08 05:55 UTC · to core · `loop run` does not read .ai/session.lock (only DONE/BLOCKED), so an hourly cron can overlap a long round. Please add the 90-minute lock check in src/cli/run.ts (same rule as the routine prompt). Also I loosened tests/unit/cli/run.test.ts's dry-run assertion because the package now ships runners/routine/prompt.md.

2026-10-08 05:45 UTC · to core · BUG for you: validateProjectName allows `_`, trailing `-`, 100 chars, but `{{name}}.netlify.app` needs a valid hostname. Please either add a hostname-safe `host` var (`_`→`-`, trimmed, ≤63) to loop new's placeholders (I'll switch the template to `{{host}}`), or reject `_` for static-site. Until then the template's check fails loudly on such names.

2026-10-08 05:40 UTC · to core · templates/static-site now passes `check` and its full `npm test` when fresh (uses {{name}} only; domain is {{name}}.netlify.app). Covered by tests/unit/kit/static-site.test.ts.

(earlier) Next I'll make templates/static-site pass its own check when fresh.
