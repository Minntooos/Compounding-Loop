# Lane templates

Files `loop init --lanes` copies into a repository that runs several lanes. A lane is one scheduled run that owns one part of the codebase (see `method/COMPOUNDING_LOOP.md`, chapter "Lanes").

| File | Written to | Once per |
|---|---|---|
| `task.md` | `.ai/lanes/<lane>/task.md` | lane |
| `outbox.md` | `.ai/lanes/<lane>/outbox.md` | lane |
| `control-room.md` | `.ai/control-room.md` | repo |
| `claude-section.md` | appended to `CLAUDE.md` and `AGENTS.md`; `loop init --lanes` wraps it in its own markers, so a second run replaces the block | repo |
| `ci-check-lanes.yml` | `.github/workflows/check-lanes.yml` | repo |

## Placeholders

Written `{{lane}}`. `loop init --lanes` fills only the ones listed below (`control-room.md` and `ci-check-lanes.yml` have none). A template never ships with one unfilled: `tests/unit/kit/lanes-templates.test.ts` fills every documented placeholder and fails on any `{{x}}` left over. GitHub Actions expressions (`${{ ... }}`) are not placeholders and are left alone.

| Placeholder | Meaning | Example |
|---|---|---|
| `{{lane}}` | Lane name (lowercase letters, digits, `-`) | `api` |
| `{{owns}}` | The lane's owned globs, comma separated | `src/api/**, tests/api/**` |
| `{{lanes}}` | All lane names, comma separated | `api, web, docs` |

`.ai/lanes.json` stays the machine-readable source of truth; `claude-section.md` points to it instead of copying the lane table, so the two cannot drift.
