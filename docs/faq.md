# FAQ

**Does it work with agents other than Claude Code?** The method is plain Markdown and works anywhere, but the runners and plugin target Claude Code.

**How much will it cost?** Runs use your own Claude plan. Set the `Run: N / LIMIT` budget to cap them.

**Can it break my repo?** It commits to git, so everything is reversible. It never force-pushes or rewrites history.

**Does anything leave my machine?** Only what Claude Code and git send already. The tool has no telemetry.

**Why did it stop?** Look for `DONE.md` (finished) or `BLOCKED.md` (needs you) in the repo root, or run `npx compounding-loop status`.
