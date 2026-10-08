# Lane: web

Run: 1 / 30
Status: units 1-5 done

## Contract
**Goal:** the dashboard, "calm mission control" (IDEA.md must-haves 19–24 and the Design section).
**Done when:**
- `npm test` passes; Playwright tests in `tests/e2e/` cover each screen on the laptop and phone projects, keyboard use (Ctrl/⌘K, j/k, a), both themes, and no console errors.
- Fleet: "Needs you" bar first ("Nothing needs you" in green at zero), one card per loop with status word + icon + colour, round X/5, run N/30, next run, tests, live check; sorted by attention. E2E asserts the five-site numbers from the demo data.
- Loop detail: header + tabs Timeline, Contract, Knowledge, Decisions, Settings.
- Inbox: every BLOCKED question, best guess pre-filled, Accept guess / write answer (POST; demo shows the read-only message).
- New-loop wizard: Brief with live linter score (import core's `src/core/brief.ts` via `@core/brief`) → Template → Runner → shows the exact `loop new` command (creation goes through the API only outside demo).
- Health page; First run ("Try the demo" / "Create your first loop"); Settings (projects folder, `gh` account, default runner, theme).
- Accessibility: every interactive element reachable by keyboard with visible focus (a test tabs through Fleet), status never colour alone, `prefers-reduced-motion` respected, 375 px with no horizontal scroll (a test asserts `scrollWidth <= innerWidth`). WCAG AA contrast in both themes.
- `web/public/logo.svg` (a loop arrow opening into a rising spiral) and a favicon.
**Constraints:** data only through the `.ai/contracts.md` routes (TanStack Query). Until the server ships, use a typed mock in `web/src/api/mock.ts` built from `demo/five-sites.json` if present, else from the shape of `.ai/reference/five-sites/` (copy only numbers and site names; no paths or emails). No `dangerouslySetInnerHTML`: render Markdown with a safe renderer (write a tiny one, or add a dependency with a Decisions entry). Tokens are in `web/src/index.css`; shadcn-style components are copied into `web/src/components/ui/`.
**When the server ships `startServer`:** switch `playwright.config.ts` webServer to `node bin/loop.js dashboard --demo --no-open --port 4173` (shared file, small edit; say so in your outbox).
**Out of scope:** server logic, CLI.

## Units, in order
1. App shell: layout, nav (Fleet, Inbox, Health, Settings), theme toggle, command palette (cmdk), router (hash or a tiny router; decide and record).
2. Fleet with demo data + e2e numbers.
3. Loop detail tabs.
4. Inbox.
5. Health + First run + Settings.
6. New-loop wizard.
7. Polish: motion on change, empty/error/loading states, phone layout, logo.

## Decisions
- Hash router (`#/loop/:id`) · works under vite preview and any static server without fallback rules · swap `web/src/lib/route.ts`.
- API client falls back to the demo snapshot only when `/api/health` is not JSON (no server), with a visible "Sample data" banner; with a server, errors surface · avoids showing fake data as real · `web/src/api/client.ts`.
- Playwright now runs `loop dashboard --demo` (server serves dist/web); previewApi removed.
- Live updates via EventSource in App.tsx; invalidate query keys by name.

## Confirmed
(facts proven by a command or test; cite path:line)

## Guesses
(unproven beliefs; never treat one as fact in a later run)

## Tried
(what failed and why, so the next run does not repeat it)

## Don't
- Edit paths another lane owns (CLAUDE.md lane table), except for the "main stays green" fix.
- Add a dependency without a Decisions entry.

## Handoff
Run 1: shipped shell, Fleet, Loop detail tabs, Inbox (j/k/a), Health, Settings; e2e in tests/e2e/{fleet,screens}.spec.ts. Next: unit 6 new-loop wizard (lintBrief via @core/brief; show `loop new` command), First run screen, then unit 7 polish (loading/error states, contrast test, logo check, Settings projects folder/gh account/default runner once server exposes them). Reviewer notes unaddressed: tabs lack arrow-key navigation; static mode still shows the answer form.
