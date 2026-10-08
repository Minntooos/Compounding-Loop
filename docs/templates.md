# Templates

`npx compounding-loop new <template> [name]` copies a template, fills `{{name}}` and `{{template}}`, then runs `init`.

| Template | For |
|---|---|
| `static-site` | A static site deployed to `{{name}}.netlify.app`. Ships with its own `npm test`. |
| `chrome-extension` | A Manifest V3 extension starter. |

Use `--dry-run` to create the files locally without making a GitHub repo.
