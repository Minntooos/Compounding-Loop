# Lane templates

Files `loop init --lanes` copies (the four run-model files `lane-run.md`, `control-run.md`, `schedule.json`, `steer.md` once core ships that hook; until then copy them by hand) into a repository that runs several lanes. A lane is one scheduled run that owns one part of the codebase (see `method/COMPOUNDING_LOOP.md`, chapter "Lanes").

| File | Written to | Once per |
|---|---|---|
| `task.md` | `.ai/lanes/<lane>/task.md` | lane |
| `outbox.md` | `.ai/lanes/<lane>/outbox.md` | lane |
| `control-room.md` | `.ai/control-room.md` | repo |
| `claude-section.md` | appended to `CLAUDE.md` and `AGENTS.md`; `loop init --lanes` wraps it in its own markers, so a second run replaces the block | repo |
| `ci-check-lanes.yml` | `.github/workflows/check-lanes.yml` | repo |
| `lane-run.md` | `.ai/lane-run.md` | repo: the run procedure every lane routine prompt points at (stop checks incl. "Not due", steering, run log, idle backoff) |
| `control-run.md` | `.ai/control-run.md` | repo: the control room's procedure (schedule backoff and wake, tests, leak check, supervision) |
| `schedule.json` | `.ai/schedule.json` | repo: `{"version":1,"lanes":{}}`; a missing lane entry means due |
| `steer.md` | `.ai/lanes/<lane>/steer.md` | lane |

## Placeholders

Written `{{lane}}`. `loop init --lanes` fills only the ones listed below (`control-room.md` and `ci-check-lanes.yml` have none). A template never ships with one unfilled: `tests/unit/kit/lanes-templates.test.ts` fills every documented placeholder and fails on any `{{x}}` left over. GitHub Actions expressions (`${{ ... }}`) are not placeholders and are left alone.

| Placeholder | Meaning | Example |
|---|---|---|
| `{{lane}}` | Lane name (lowercase letters, digits, `-`) | `api` |
| `{{owns}}` | The lane's owned globs, comma separated | `src/api/**, tests/api/**` |
| `{{lanes}}` | All lane names, comma separated | `api, web, docs` |

`.ai/lanes.json` stays the machine-readable source of truth; `claude-section.md` points to it instead of copying the lane table, so the two cannot drift.
