---
description: Split this repository into parallel lanes, each owning its own folders, so scheduled runs never edit the same files
---

Set up lanes in this repository.

1. Ask the user which parts of the code could be built independently (for example `core`, `web`, `docs`) and which folders each one owns. Keep it to two to five lanes.
2. Run `npx compounding-loop init --lanes <name1>,<name2>,... --dry-run` and show the user what it would write.
3. After a yes, run it again without `--dry-run`. It writes `.ai/lanes.json` and a task file, outbox and lane section per lane. Existing files are kept.
4. Open `.ai/lanes.json` and replace the placeholder `owns` globs (`<name>/**`) with the real folders.
5. From now on every commit ends with a `Lane: <lane>` trailer. `npx compounding-loop check-lanes` verifies ownership and can run in CI. To add a lane later: `npx compounding-loop lanes add <name> --owns "<glob>"`.
