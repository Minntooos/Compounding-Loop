---
description: Pick the next open unit with a teammate in mind, claim its lane and start working
---

Find work in this repository without colliding with a teammate or a scheduled run.

1. Run `npx compounding-loop next --json`. It lists the open units across all lanes with their claims and recommends one nobody holds. If it recommends nothing, say so and stop.
2. Show the user the recommended lane and unit in one line and wait for a yes, or for a different lane.
3. Claim it: `npx compounding-loop claim <lane> --as <name>` (the name defaults to `git config user.name`). This commits `.ai/lanes/<lane>/claim` with the trailer `Lane: <lane>` and pushes.
4. Read `.ai/lanes/<lane>/task.md` and work the unit as that lane: edit only the paths the lane owns, end every commit with `Lane: <lane>`.
5. When you stop, run `npx compounding-loop release <lane>`. An unreleased claim expires by itself.
