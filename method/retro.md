# Retro

Run it when the checks pass, before deleting `.ai/task.md`. About two minutes.

1. List what was learned. For each item: does it apply beyond this task? Is it confirmed or a guess? At what moment would it have helped (file, command or error)?
2. Move general, confirmed items down the promotion ladder as far as they go: `guess → confirmed note → note with a trigger → automated check`. The best memory is one the model never has to read: turn a rule into a lint, test or script and delete the prose.
3. Write each kept lesson as a knowledge entry (`.ai/knowledge/K-NNNN.md`, see `method/example/K-0001.md`) with triggers, and add one line to `.ai/index.md`.
4. Flag entries this task showed to be wrong or stale. Never delete a CONFIRMED entry without new evidence.
5. Add one line to `.ai/log.md`: date, task, checks result, runs used, what was learned.
6. Delete `.ai/task.md`.
