# CLAUDE.md

## Project core

**What this is:** a static niche website built by an unattended AI loop. The goal, audience and keywords are in [IDEA.md](IDEA.md). The owner's aim is organic search traffic.

**Why this site can win:** in 2026 every tool niche already has 5–10 AI-built sites, most with a handful of thin, unchecked tools, abandoned after launch. This site wins on three things they skip: **depth** (the complete set of tools and answers for the niche, cross-linked), **verified correctness** (every number unit-tested against a cited source) and **honest, useful pages**. Every rule below serves one of those three.

**Commands**
- Install: `npm install`, then `npx playwright install chromium`. If Chrome then fails to launch over missing system libraries, run `npx playwright install-deps chromium`. If the browser download is blocked (it is in Claude's cloud sandbox), `playwright.config.js` automatically uses the preinstalled Chromium in `/opt/pw-browsers` or a system Chrome, so just run `npm test`. If neither works, record it under Decisions and use `npm run check && npm run unit` as the gate.
- Run locally: `npm start` (serves `site/` at http://localhost:4173 with the production headers, read from `vercel.json`)
- Test (the only judge of "done"): `npm test` = `check` + `unit` + browser tests
- Fast checks only: `npm run check` (SEO, quality, security), `npm run unit` (calculation tests)

**Hard rules**
- Everything the public sees lives in `site/`. The site is hosted on Netlify, which publishes only that folder (`publish = "site"` in `netlify.toml`; `vercel.json` says the same with `"outputDirectory": "site"`), so `CLAUDE.md`, `.ai/` and `IDEA.md` stay private. Never move them into `site/` and never change `publish` or `outputDirectory`; `npm run check` fails if `outputDirectory` changes.
- Plain HTML, CSS and ES modules, with no build step, unless IDEA.md needs something more. If it does, record the decision and the reason in `.ai/task.md` under Decisions.
- One page per search intent: each target keyword cluster gets its own URL, `<title>`, meta description, `<h1>` and JSON-LD. Cross-link the pages. Update `site/sitemap.xml` whenever a page is added.
- Mobile first. No horizontal scroll at 375px wide. The main tool must be usable without scrolling on a 633px-tall laptop screen.
- Pushing to `main` publishes the site (Netlify deploys every push to `main`), and the owner has approved auto-publishing. Push only when `npm test` passes and the reviewer found no blockers (see Unattended mode).

**URLs**
- The home page is `site/index.html`. Every other page is `site/<slug>/index.html`, linked as `/<slug>/`, with canonical `https://<domain>/<slug>/`. Slugs are lowercase, hyphenated and keyword-first.
- Use the address from IDEA.md's Domain section in every canonical, the sitemap and robots.txt. For now it's a free `<name>.netlify.app` address, because the owner hasn't bought the domain yet. Never use any other address, such as a `<hash>--<name>.netlify.app` deploy URL, a `vercel.app` address or the unbought domain. `npm run check` fails if a canonical uses a different host. Only the owner changes the address.
- Keep any `<meta name="google-site-verification">` tag on the home page. It proves ownership to Google Search Console.
- Never change a published URL. If you must, add a permanent (301) redirect to both `netlify.toml` (`[[redirects]]`) and `redirects` in `vercel.json`.

**Correctness** (the main edge over competitors)
- Every formula, conversion or lookup is a pure function in `site/js/lib/<topic>.js`, with no DOM access. Page scripts import it.
- Each lib file has `tests/unit/<topic>.test.mjs` (`node:test`), and `npm run check` fails without it. Each function needs at least two reference cases taken from an authoritative source: a manufacturer, a standards body, a textbook or a well-known reference chart. Put the source URL in a comment above each case. A test that only re-derives your own formula proves nothing.
- Also test the edges: zero, empty input, unit conversion both ways, impossible inputs. The page shows a clear message for bad input, never `NaN`, `Infinity` or `undefined`.
- Show units everywhere. Support imperial and metric when the audience uses both. Round only for display.

**Facts and data**
- Product specs, constants and reference tables go in `site/data/*.json`. Every entry has `source` (URL) and `checked` (YYYY-MM-DD). Find primary sources with WebSearch and WebFetch. If you can't verify a value, leave the entry out rather than guess.
- In the cloud sandbox, WebFetch is blocked for most websites by the network allowlist (CONFIRMED, October 2026), but WebSearch works and its results quote the source pages. A value counts as verified when a search result from the authoritative source itself states it, or when two independent reputable sources agree. Give the entry the source's URL and `"via": "search"`. Never use a value only because it seems plausible, and don't stop the build over one unverifiable value: leave it out and move on.
- Where real-world values vary (appliance wattage, fish adult size), say so on the page and give the typical range.

**Content quality** (Google's spam policies)
- Each page fully answers its search intent with original writing: the tool, how to use it, how it's calculated, a worked example and a short FAQ. `npm run check` requires 300+ visible words and fails pages that share more than 60% of their phrasing.
- No doorway pages: never make pages that differ only by a swapped word. A page earns its URL with its own data, examples or advice.
- No fake authority: no invented reviews, testimonials, user counts, "as seen on" badges or author bios, and no claims of hands-on testing.
- Where the topic touches safety (chemicals, electricity, animal health), add the relevant safety note and point to the authoritative source.

**Security**
- `netlify.toml` and `vercel.json` send the same strict Content-Security-Policy (keep their headers identical): same-origin scripts only, no inline scripts, no inline event handlers and no iframes. `npm start` sends the same headers, so the browser tests catch violations, and `npm run check` flags them earlier.
- Never put user input or URL parameters into `innerHTML`. Use `textContent` or build elements.
- No runtime npm packages and no CDN scripts. The only dependencies are the dev-only test tools in `package.json`.

**Design**
- Fast: system font stack, images under 100 KB each, no layout shift.
- Accessible: a label on every input, visible focus, AA contrast, fully usable by keyboard.
- Remember the visitor's last inputs and units in `localStorage` (wrapped in try/catch).
- Results print cleanly (a print stylesheet): hobby visitors print their numbers.

---

## Operating Card (the Compounding Loop)

> The full method is in `.ai/method.md`. The § numbers point to Part B there.

**Objective:** the most verified-correct results per minute of the owner's attention. Tokens are the cheapest resource. A wrong result that looks right is the most expensive one.

**Start of every session**
1. Read `.ai/index.md`. Open a knowledge entry only when it's relevant to what you're doing.
2. If `.ai/task.md` exists, run the resume protocol (§9.2) before anything else.

**Before work**
3. Size the task. Tiny: just do it. Medium: contract + checks. Large or unclear: plan, then loop.
4. For medium and large tasks, write the contract (§5): goal, done-when (checkable by a command), constraints, out of scope.

**During work**
5. One unit of work at a time. Run the checks after each unit. You never declare done; the checks do.
6. Write a note the moment you learn something, marked CONFIRMED or GUESS. Don't save it for the end.
7. After any error, search `.ai/index.md` for the error text before trying a fix.
8. Before editing a file, check the index for entries about that path.
9. Send reading-heavy work (search, docs, logs, review) to subagents that report back in 10 lines or fewer. Keep code-writing in one thread.
10. Same failure twice: stop and run the stuck protocol (§9.3). Don't retry a variant.
11. If reality contradicts the plan or contract, stop and record it (see Unattended mode). Don't silently work around it.
12. Point to code and docs (`path:line`). Never copy them into notes.

**Context**
13. At ~50–60% context, or when a unit is done and the next one is big: run the handoff (§9.1) and end the run.

**Finishing**
14. When the checks pass, run the retro (§12), log the task and delete `.ai/task.md`.

**Never**
- Mark your own work done without the checks passing.
- Treat a GUESS from an earlier window as fact.
- Delete or rewrite CONFIRMED knowledge without new evidence.
- Change this card.

---

## Unattended mode

No human is watching. The owner reads the results later. These rules replace "ask the human":

- **Git:** work on `main` and push to `main`, never to a `claude/` branch. The next run starts from `main` and would never see work left anywhere else. Start every run with `git checkout main && git pull --ff-only`. If a push is rejected, run `git pull --rebase` once and push again. If that conflicts, run `git rebase --abort`, record it under Tried, and stop.
- **Questions:** decide using IDEA.md and common sense, write the decision and the reason under **Decisions** in `.ai/task.md`, then keep going. Pick the option that's easiest to reverse.
- **Plan approval:** for large tasks, write the plan in `.ai/plans/`, have a reviewer subagent attack it ("what are the 3 most likely ways this plan fails?"), fix the plan, then build.
- **Review before every push to `main`:** `npm test` must pass. Then a reviewer subagent that didn't write the code checks the diff with the brief: "Find the three most likely ways this is wrong for a real visitor, and check each one." Fix any blocker first.
- **Stuck protocol, last step:** there's no human to ask. Write `BLOCKED.md` (what you tried, the specific question, your best guess), commit it, push it, and stop.
- **Run budget:** `.ai/task.md` holds `Run: N / LIMIT`. Add 1 at the start of every run. When N reaches LIMIT, write `BLOCKED.md` saying "run budget reached", push it, and stop.
- **Finished:** when every done-when in the contract passes and the reviewer finds no blockers, run the retro, write `DONE.md`, delete `.ai/task.md`, push and stop. `DONE.md` holds: what was built (each page and its target keyword), test results, anything you were unsure of, and the owner's launch checklist: check that the Netlify site serves the address in IDEA.md, add that address to Search Console as a URL-prefix property, submit `/sitemap.xml`, and buy the domain named in IDEA.md once there's budget for it. End with the 10 best next pages to build, ranked by search demand and how weak the current results are.
- **If `DONE.md` or `BLOCKED.md` exists at the start of a run:** do nothing and stop.

**Never, even if it seems helpful**
- Spend money, sign up for anything, or create accounts.
- Add API keys, secrets, ads, analytics or tracking code. The owner adds those later.
- Copy text, images or code from competitor sites. Write original content and use original or properly licensed assets.
- Force-push, rewrite git history, or touch anything outside this repository.
