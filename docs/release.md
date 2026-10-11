# Release to npm without a token

Releases run in GitHub Actions with npm **trusted publishing**: npm trusts the workflow itself (OIDC), so no npm token exists anywhere, in the repo, in GitHub secrets, or in a chat. The workflow is [`.github/workflows/release.yml`](../.github/workflows/release.yml). Only the owner can start it, and only after a second click on the protected `release` environment.

## One-time setup (the owner, about 5 minutes)

1. **Publish once by hand.** npm needs the package to exist before it accepts a trusted publisher. Skip this if `compounding-loop` is already on npmjs.com. Do this one without `--provenance`, which only works from CI.
2. **Trust the workflow on npm.** npmjs.com → the `compounding-loop` package → *Settings* → *Trusted publisher* → *GitHub Actions*. Fill in: owner `Minntooos`, repository `Compounding-Loop` (type it exactly like this; npm compares case), workflow filename `release.yml`, environment `release`.
3. **Create the environment on GitHub.** Repository → *Settings* → *Environments* → *New environment* named `release` → tick *Required reviewers* and add yourself. Optionally limit *Deployment branches* to `main`.

That is all. No secret is added in either place.

## Every release

1. The round is done (root `DONE.md` exists), the version in `package.json` is the one to publish, and `CHANGELOG.md` has a section for it.
2. Run `npx compounding-loop ship-check` (or open the Ready to ship panel in the dashboard). It lists what is missing and exits 0 only when you can release.
3. GitHub → *Actions* → *Release* → *Run workflow*. The **dry run** box is ticked by default: the first run does everything except publish, tag and release. Untick it for the real run.
4. Approve the run when GitHub asks for the `release` environment's reviewer.

## What the workflow does

`npm ci`, `npm test`, `loop ship-check`, a check that this version is not on npm yet, `npm pack --dry-run`, then the release notes are cut from the matching CHANGELOG section. A real run then publishes with `npm publish --provenance --access public`, and creates the `v<version>` tag and the GitHub release with those notes. A dry run stops before that step and prints "Dry run passed".

If a check fails, nothing is published. Fix the cause, push, and run it again. The version is never bumped by the workflow or by the loop's lanes: you change `version` yourself in a normal commit.
