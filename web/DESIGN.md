# Dashboard design spec (0.3.0 "Showcase")

Every web unit in round 3 is built to this file and judged against it (see "Review checklist" at the end).
Principles stay as in IDEA.md "Design": calm mission control, "Needs you" first, every number links to proof, status is never colour alone, motion only for change, keyboard first.

## 1. What is wrong today (before screenshots in `web/design/before/`)

| # | Problem | Evidence |
|---|---|---|
| P1 | A first-time visitor is never told what this is or how to install it | `fleet-light-desktop.png` |
| P2 | Cards are label/value text tables: "Round 5/5", "Run 0/30" have no sense of progress | same |
| P3 | The self-build card shows "Round 1/2", "no result", "not checked": reads as broken | same, second card |
| P4 | The timeline is one flat list, no grouping, no lane colour, relative times that rot ("4d ago") | `loop-dark-desktop.png` |
| P5 | At 375 px the nav wraps ("New / loop") and the theme toggle drops to its own row | `fleet-light-phone.png` |
| P6 | One console 404 on load | owner review |
| P7 | Loading, error and rate-limited states are not designed as a family | audit M-list |

## 2. Research: patterns borrowed

Method note, stated honestly: only Vercel's public Geist docs (status dot, deployment status) were re-read online during this run; the other products are described from working knowledge of their interfaces and should be read as design inspiration, not citations. Everything below is paraphrased; no text, image or code is copied.

| Product | Pattern | What we take |
|---|---|---|
| Vercel | One status dot with a small fixed vocabulary (queued, building, error, ready, canceled), always paired with a word; rows pair the dot with a title and a relative time | One `StatusDot` with fixed states and a mandatory text label; one line under each lane saying what it is doing now |
| GitHub Actions | State icons differ by shape, not only colour; failed steps open by default, passing ones stay collapsed | Distinct shapes per state (tick, cross, hollow ring, pulsing ring); failures expanded, healthy things quiet; elapsed time on running work |
| Linear | Pie-style glyphs fill as work advances; lists are dense, grouped by state with counts; very few colours, saturation kept for exceptions | A ring/bar per loop for rounds and run budget; group headers carry counts; muted palette, colour reserved for state and lanes |
| Grafana | Big-number panels with a sparkline; a "last refreshed" stamp in the top bar; each panel has its own error marker; "no data" is distinct from zero | Header live/snapshot chip with age; per-section error state so one failed fetch never blanks the page; "no result" never printed as 0 |
| Railway | Grid of service cards with a status dot and the latest deploy line; guided empty state with the next step | Fleet cards with latest event line; empty states always name the one command to run |
| Sentry | Per-row sparkline and first/last-seen pair; onboarding as copyable steps; error and quota banners say what happened, when it resets, what still works | Welcome strip with a copy button; rate-limit notice says it falls back to the snapshot and when live resumes |
| Statuspage-style status pages | One overall banner; a thin per-day strip per component; incident timeline grouped by day | One overall banner ("Nothing needs you"); per-lane day strip in the loop detail; day-grouped timeline with sticky headings |

Decisions that follow: group by day and colour by lane (not by commit author); show absolute UTC time as the primary label and relative on hover/title (relative times rot in a static snapshot); keep the palette quiet and use the lane colours only for lane identity.

## 3. Tokens

The IDEA.md palette is kept unchanged (`web/src/index.css`). Additions only:

| Token | Dark | Light | Use |
|---|---|---|---|
| `--surface-2` | `#181B21` | `#F3F4F6` | hover rows, chips, code box |
| `--lane-core` | `#56B4E9` | `#0072B2` | lane identity (dot, day-strip, timeline bar) |
| `--lane-kit` | `#F0A030` | `#B84A00` | same |
| `--lane-server` | `#2FC79A` | `#007A5A` | same |
| `--lane-web` | `#E08BBE` | `#A8467F` | same |
| `--lane-docs` | `#E5D44A` | `#8A6D00` | same |
| `--lane-other` | `--muted` | `--muted` | control room and any lane beyond five |

Lane colours follow the Okabe-Ito family, tuned so each passes WCAG AA (4.5:1) as text on both `--bg` and `--surface` (measured: light 4.71 to 5.46, dark 7.43 to 12.96). Lane colour is never the only signal: every use carries the lane name (or a one-letter badge in tight spaces), and lanes beyond the five cycle through `--lane-other`. Lane colours are separate from the five status colours, which keep their meaning.

**Type scale** (Inter variable, JetBrains Mono for commands/SHAs/times; weights 400/500/600; tabular numerals on counts and times): 12 meta, 13 labels and rows, 14 body (current base, kept), 18 section title, 24 page title, 32 hero number. Line height 1.45 text, 1.2 numbers.
**Space** 4-px grid: 4, 8, 12, 16, 24, 32, 48. Card padding 16 (12 at 375 px). Page gutter 24 desktop, 16 phone. Radius 8 cards, 999 chips. Hairline 1 px borders, no shadows (a single soft shadow only on the open command palette).
**Touch targets** at least 44 px high on phone.

## 4. Components

- **StatusDot + word**: icon shape per state (done tick, building ring that pulses once when data changes, blocked bar, failing cross, idle hollow). Always has a word.
- **ProgressBar**: 6 px track, fill in the state colour, text beside it ("Round 2 of 2", "15 of 150 runs"); `role="progressbar"` with `aria-valuenow/max`. Never implies precision: no percent.
- **LaneChip**: dot in lane colour + name; filter chips are the same component as a toggle button.
- **LiveChip** (header): `Live · updated 14:05 UTC` (green dot) or `Snapshot from 11 Oct` (static grey dot, calm wording); becomes amber after 5 minutes without a refresh; click opens a small popover with source and why. Never shown with a local dashboard server, which is always "this machine".
- **CommandBox**: monospace command, copy button, "Copied" for 1.5 s, selects the text if the Clipboard API is missing.
- **Notice**: calm inline strip (info/warn), icon + one sentence + optional action. Used for rate limits, snapshot fallback, errors with retry.
- **Skeleton**: final-layout placeholder blocks (no spinner-only screens); static under reduced motion.
- **Sparkline/Chart**: hand-written SVG, no chart library (no new dependency, keeps the bundle small). Axis text 12 px, a visible text/table alternative via `<title>` and an `aria-label` summarising the data.

## 5. Layout per screen

**Shell.** Desktop: top bar (brand, tabs Fleet / Inbox / Health / New loop / Settings, LiveChip, theme toggle), content max-width 1120. Phone: brand row with LiveChip and theme toggle, tab bar beneath it as a single horizontally scrollable row (no wrapping, `white-space: nowrap`, fades at the edge), 44 px targets. The `<h1>` is the screen's content title, not the brand repeated.

**Fleet.**
1. Welcome strip (demo mode only; hidden when a local server runs; dismissible, remembered in `localStorage` inside try/catch; comes back if the dismissal cannot be stored): one sentence ("Compounding Loop runs Claude Code build loops unattended and checks every result. This page is the repo that built it, live."), CommandBox with `npx compounding-loop dashboard`, GitHub link. Replaces the grey banner.
2. Overall banner: "Nothing needs you" or "N things need you" with the first item linked.
3. Self-build card first and wider on desktop (spans two columns): name, state word, story line ("Round 2 of 2 done · 0.2.0 shipped"), lane row (five LaneChips with run N/limit mini bars), last activity as absolute UTC, links to commit and live site. Other loops: 3-up grid desktop, 1-up phone.
4. Card anatomy: title + StatusDot word; one-line summary; ProgressBar for rounds; ProgressBar for run budget; last activity ("14:05 UTC · 3 commits"); rows with no data are omitted rather than printed as "no result".

**Loop detail.** Header: name, StatusDot word, round story line, LiveChip. Tabs as today (Timeline, Lanes when present, Contract, Knowledge, Decisions, Settings). The `Timeline` tab: filter row of LaneChips (multi-select, "All" default, `aria-pressed`); a runs/tests-over-time chart above the list; commits grouped under sticky day headings ("Sun 11 Oct", count), each row: lane bar (3 px, lane colour) + lane name text, subject, SHA link, absolute `HH:MM UTC` time with relative in the `title`. Bursts of the same lane within a day are not collapsed in this release. `Lanes` tab: one row per lane with StatusDot word, run N/limit bar, claim ("name · expires 16:30 UTC" or "unclaimed"), last commit, a 30-day day strip.

**Inbox / Health / Settings / New loop.** Same shell; sections use the Notice, Skeleton and empty-state components; no layout changes beyond the type scale and spacing tokens, and the 375-px rules below.

## 6. States (every screen)

| State | Treatment |
|---|---|
| Loading | Skeleton in the final layout, announced with `aria-busy` |
| Empty | One sentence on what appears here + the command that makes it happen |
| Error | Notice (what failed in plain words) + last good data if any + Retry button |
| Rate-limited | Notice: "GitHub's anonymous limit was reached, so this shows the snapshot from <date>. Live view resumes about <time>." No automatic retry until then |
| Stale live | LiveChip turns amber; data stays visible |
| Snapshot | Calm: "Snapshot from <date>", no warning colour |

Live mode caches 5 minutes per tab (`sessionStorage`, every access in try/catch) and refreshes every 5 minutes while the tab is visible.

## 7. Motion

Only to show change: a card's status dot pulses once when its data changes; chart draws without animation. Toasts fade in 150 ms. Everything off under `prefers-reduced-motion` (already enforced globally in `index.css`).

## 8. Phone (375 px)

Single column; header 56 px with LiveChip and theme toggle on the brand row; scrollable tab bar; cards 12 px padding; timeline rows become two lines (subject first, lane + time + SHA second); lane filter chips scroll horizontally inside their row only; no horizontal page scroll; no wrapped tab labels; targets at least 44 px.

## 9. Accessibility

axe (wcag2a/aa/21aa) zero serious/critical on all screens, both themes, at 1440 and 375 px; visible focus ring (accent, 2 px); every state conveyed by word + shape; chart has a text alternative; all new text meets 4.5:1 on its actual background.

## 10. Review checklist (used by the independent reviewer in unit 9)

1. First screen of Fleet says what this is and shows the copyable command (demo mode); absent with a local server.
2. Self-build card is first and tells the round story; no "no result"/"not checked" rows.
3. Cards show round progress and run-budget bars with text.
4. Timeline is grouped by day, lane-coloured with lane names, filterable, absolute UTC times.
5. Runs/tests chart present with a text alternative.
6. Lanes rows show claims.
7. 375 px: nav fits on one row, no wrapped labels, no horizontal scroll.
8. Loading, empty, error and rate-limited states exist for every screen.
9. Light and dark both pass axe and the contrast tests; reduced motion respected.
10. No console errors or 404s; bundle under 300 kB gzip.
