# Contributing

Thanks for helping. The bar is simple: nothing counts until a test proves it.

## Setup

```sh
npm install
npx playwright install chromium   # or rely on a system Chrome; see playwright.config.ts
npm test
```

`npm test` runs, in order: `check` (repo invariants), `typecheck`, `unit` (Vitest), `build`, `e2e` (Playwright). It needs no network access and no GitHub login. Run any step alone with `npm run check`, `npm run unit`, and so on.

## Where things live

| Path | What |
|---|---|
| `src/core`, `src/cli` | Pure logic and the `loop` command |
| `src/server` | Local HTTP API and the demo snapshot (`demo/`) |
| `web` | The dashboard (React + Vite) and its end-to-end tests |
| `method`, `templates`, `runners`, `plugin` | The method, starter repos, schedulers, Claude Code plugin |
| `docs`, `launch` | Documentation and launch drafts |

## Rules for a pull request

- Strict TypeScript. No `any` without a comment saying why.
- Small pure functions in `src/core`; every exported function has a test.
- Shell out only with `execFile`/`spawn` and an argument array.
- Never put user or repo text into `innerHTML`.
- Cross-platform: use `node:path`, never a hard-coded `/`.
- No telemetry, analytics, runtime CDN loads or secrets. `npm run check` enforces several of these.
- A new dependency needs a reason in the pull request.

Fill in the pull request template and keep the change focused. For anything larger than a bug fix, open an issue first so we can agree on the shape.

## Good first issues

See [launch/good-first-issues.md](launch/good-first-issues.md) for starter tasks.

By contributing you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
