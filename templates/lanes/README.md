# Lane templates

Files `loop init --lanes` copies into a repository that runs several lanes. A lane is one scheduled run that owns one part of the codebase (see `method/COMPOUNDING_LOOP.md`, chapter "Lanes").

| File | Written to | Once per |
|---|---|---|
| `task.md` | `.ai/lanes/<lane>/task.md` | lane |
| `outbox.md` | `.ai/lanes/<lane>/outbox.md` | lane |
| `control-room.md` | `.ai/control-room.md` | repo |
| `claude-section.md` | appended to `CLAUDE.md` and `AGENTS.md` | repo |
| `ci-check-lanes.yml` | `.github/workflows/check-lanes.yml` | repo |

## Placeholders

Written `{{name}}`. A template never ships with one unfilled: `tests/unit/kit/lanes-templates.test.ts` fills every documented placeholder and fails on any `{{x}}` left over. GitHub Actions expressions (`${{ ... }}`) are not placeholders and are left alone.

| Placeholder | Meaning | Example |
|---|---|---|
| `{{name}}` | Project name | `acme-shop` |
| `{{lane}}` | Lane name (lowercase letters, digits, `-`) | `api` |
| `{{owns}}` | The lane's owned globs, as markdown code, comma separated | `` `src/api/**`, `tests/api/**` `` |
| `{{limit}}` | Run budget for the lane | `20` |
| `{{lane_table}}` | Markdown table rows, one per lane: `\| name \| owns \| task file \|` | |
| `{{lane_count}}` | Number of lanes | `3` |
| `{{lane_names}}` | Lane names, comma separated | `api, web, docs` |
| `{{date}}` | Date of creation, `YYYY-MM-DD` | `2026-10-08` |

`.ai/lanes.json` stays the machine-readable source of truth; the table in `claude-section.md` is its readable copy.
