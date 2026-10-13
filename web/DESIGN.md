# Dashboard design spec (0.3.0 "Showcase"; section 11 adds 0.4.0 "Control")

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

## 11. Round 4 (0.4.0 "Control"): Runs, Tests, Releases, Ready to ship, action buttons

Same tokens, components and states as sections 3-9. Nothing here adds a UI library or a chart dependency; charts stay hand-written SVG.

**The 5-second fleet card rule.** A card shows only: state word + icon, one line on what is happening or needed, progress, last activity (absolute UTC). The newest run outcome goes *into the one status line* ("Last run 21:44 UTC: pushed" / "2 runs missed"), never as an extra row. No chart, table or list on a card. Anything longer lives on the loop page.

**Paused state.** When `.ai/PAUSED` exists: the card's state word becomes "Paused" (hollow pause icon, neutral colour, not an error), its line reads "Paused by <name> since 14:05 UTC" plus the reason if given, the loop page gets a Notice at the top, and the primary button becomes Resume. Lane rows keep their data but their words read "paused". Never red: pausing is a deliberate choice.

**Runs tab** (loop page, after Lanes). A lane filter (same LaneChip toggles as Timeline), then rows grouped by day. Row: lane bar + lane name, absolute `HH:MM UTC`, outcome word with icon, units as plain text, commit count, tests as "N passed" or "N failed" (failed in the danger colour, with the cross icon). Outcomes, each a word plus a shape: *Pushed* (tick), *Ran, pushed nothing* (hollow circle), *Tests failed* (cross), *No run recorded* (dashed circle; detail line "usage limit, idle or failed"). Missed slots sit in the list at their scheduled time. Above the list, once three or more consecutive slots of any lane are missed, a warn Notice: "Lanes are not running: check your plan's usage limit." (also an attention item on the fleet). Empty: "No runs recorded yet. Runners call `loop runs log` at the end of each run."

**Tests tab.** A small SVG line chart of passed (and failed, as markers) per run over time with a `<title>`/`aria-label` summary ("Tests: 176 passed on 11 Oct, no failures in the last 20 runs") and a table alternative under a disclosure. Below it "Last failure": time, lane, commit link, or "No failure recorded". Empty: "No test results yet."

**Releases tab.** One row per CHANGELOG version, newest first: version, date (or "Unreleased"), item count; expands to its sections as plain lists (text only, never HTML). A version with a matching tag shows "Tagged"; otherwise nothing is implied. Empty: "No CHANGELOG found."

**Ready to ship panel** (only when root `DONE.md` exists; top of the loop page and a link from the fleet attention item). Heading "Ready to ship" or "Not ready to ship" (word + icon, never colour alone), then the ship-check items from `shipCheck`, each one line: tick or cross + label + detail. Then open findings from `DONE.md` (collapsed past 5), the CHANGELOG entry for the version, and the `launch/` drafts, each with a Copy button (CommandBox rules). The Release button sits at the bottom and is disabled with the first failing item named when not ready.

**Action buttons** (Pause / Resume, Start next round, Release). Primary = filled accent (one per panel), secondary = outline. All three have a *confirm step* before anything happens: a small dialog (`role="dialog"`, focus trapped, Esc closes, focus returns to the button) that says in plain words what will change in the repo ("Adds `.ai/PAUSED` on main. All lane runs and the control room stop until you resume.") with Cancel and the action's own verb as the confirm button (never "OK"). What opens:
- *Static demo:* the confirm button opens the server lane's prefilled GitHub URL in a new tab (`rel="noopener noreferrer"`); the dialog says "GitHub opens on a page you still have to submit." Nothing is sent from the dashboard and no token is asked for or stored.
- *Local server:* calls the server action endpoint; shows a spinner-free pending label ("Pausing…"), then a toast and a refresh. A failure is an inline Notice in the dialog with Retry.
- Start next round adds a textarea for the brief with the live brief score beside it; the confirm button stays disabled below the score threshold with the reason in text.
Buttons are never shown disabled without a reason in adjacent text. Targets are at least 44 px on the phone.

**Snapshot-date labels.** Wherever data comes from the static snapshot, the loop page header and each tab's heading area say "Snapshot from 6 Oct" (calm, not a warning). Live data says "Live · updated HH:MM UTC". The same words as the LiveChip; never relative dates ("3 days ago") in the label.

**Site loops.** Loop page and card show "N pages" and a "Live site" link (external-link icon, new tab, `rel="noopener noreferrer"`). Search Console numbers appear only with a local server key and never on the static demo.

**Control-room note and commit author.** The self card and loop page show the newest control-room note per lane as one muted line ("control room · to core: …", truncated with a full-text `title`). Timeline rows show the commit author's display name after the lane name (never an email).

**States for every new screen** follow section 6: Runs, Tests and Releases each have Skeleton, empty, error-with-Retry and rate-limited variants; the Ready to ship panel has loading and error; the confirm dialog has pending and failed. Reduced motion: no dialog transition, no chart animation.

**Review checklist additions (11-16).**
11. Runs tab shows all four outcomes by word and shape, and missed slots at their time.
12. Three missed runs in a row raise a Notice and a fleet attention item.
13. Pause, Next round and Release each show a confirm step that says what changes; on the demo they open the exact prefilled GitHub URL; no token field anywhere.
14. Ready to ship lists every ship-check item with a reason; Release is disabled with the first failing item named.
15. Paused loops read "Paused by <name> since <time>", not as errors.
16. Fleet card stays a 5-second glance: no chart or table on it.

## 12. Round 5 (0.5.0 "Cockpit"): glance, steer, sleep

Same tokens and rules as sections 3-11; no new dependency (heat map and strip are plain HTML/SVG). The bar: from the home screen alone, in 5 seconds, the owner answers *anything need me? running or stalled? limit stops? CI? ready to ship?* Each answer has exactly one place, and each place is a word plus a shape, never colour alone.

**One attention list.** `attentionItems(loops, inbox)` (`web/src/lib/lanes.ts`) is the single source for the fleet banner count, the Inbox nav badge, the status strip's "needs you" segment and the Needs-you rows. Nothing computes its own count.

**Status strip** (C1, top of every page, under the header, full width, `role="status"` but announced only on change). One line at 1440 px, two at 375 px (line 1 = state and needs-you, line 2 = the rest), never horizontally scrolling. Segments in fixed order, separated by a middle dot, each a 16 px icon + word:
1. *Loop state*: Running (filled ring, pulses once on change) · Likely running (half-filled ring) · Idle (hollow circle) · Sleeping (moon) · Stalled (warn triangle: due slots passed with no run line, or A2's "Routines look off") · Paused (pause bars, neutral) · Done (tick) · Release waiting (tag, blocked colour) · Released (tag with tick: "0.4.0 released 13 Oct").
2. *Needs you*: "2 need you" (blocked colour, links to the Inbox) or "Nothing needs you" (done colour).
3. *Round*: "Round 5 · 3 of 7 done-whens" (or the server's `roundLabel`).
4. *CI*: "CI passing" (tick) / "CI failing" (cross) / "CI not checked" (grey dash).
5. *Limit stops*: "2 limit stops in 5 h" (warn colour, links to the Runs tab) or "No limit stops" (muted); "Limit stops not checked" while run data is missing, so none and unknown never look alike.
6. *Ship*: "Ready to ship" (tick) / "Not ready · <first failing check>" / "Released 0.4.0" / omitted while the round is still building (nothing to ship yet is not a question).
7. *Next due*: "next: web 02:15 UTC" or "all lanes sleeping".
On the fleet it summarises every loop; on a loop page, that loop. Precedence for segment 1 is by what needs action: Stalled > Release waiting > Running > Likely running > Paused > Sleeping > Idle > Released/Done, and a stalled lane is also an attention item, so Paused can never hide it. Text 13 px; height 32 px desktop, 2 × 28 px phone.

**Needs-you row** (C2; fleet top and Inbox). Card row: icon + one-sentence reason (what happened, in plain words) + loop name + the action inline as a button on the right (wraps under the text at 375 px, 44 px target). Actions per kind: release waiting → *Review & release* (opens Ready to ship); BLOCKED question → *Answer* (local, opens the answer form) or *Edit on GitHub* (demo); stalled / limit stops / "Routines look off" (A2, once, not per slot) → *What this means* (disclosure with one paragraph) + *Wake* (local: `POST …/schedule {action:'wake'}`; demo: *Edit on GitHub* on `schedule.json`); failing (CI or tests) → *Open checks* (Health, or the Tests tab); round done and released → *Start next round*. Rows are ordered: blocked questions, failing, limit stops, stalled, release waiting, round done. "Edit on GitHub" is the one word for every demo action that opens GitHub's editor. Empty: the existing green "Nothing needs you" strip.

**Heat map** (C3; loop page Overview and the Runs tab head). A grid: one row per lane (lane name left, 13 px, lane colour dot), one column per hour of the last 24 h, newest right. At 375 px it folds to the last 12 h: lane name becomes its one-letter badge (24 px column), cells 20 × 20 px with gap 2 (12 × 22 + 24 = 288 px, inside the 343 px content width); "Show 24 h" makes the grid scroll sideways *inside its own container* with the A6 fade, never the page. Desktop cells 20 × 20 px, gap 2; radius 4. One cell per expected slot; an hour with no slot for that lane is blank space (no cell). Outcome = fill + an inner glyph so it never relies on colour, and the words are the ones core's run outcomes use (B3), shared with the Runs tab (which moves to the same vocabulary): *worked* (done colour, solid with tick), *idle* (surface-2, hollow ring), *not due* (no fill, dotted outline), *likely running* (building colour, half-filled ring), *limit stop* (warn colour, slash), *failed* (failing colour, cross), *paused* (muted, pause bars), *done* (muted, tick outline). The old Runs-tab "No run recorded" dashed circle becomes *limit stop* or *failed*. The pause-bars glyph means paused everywhere; the §4 blocked state keeps its single bar. Legend below the grid, one line, each swatch with its word. Each cell is a link (`aria-label="web 14:00 UTC: worked, 2 units"`) to `#/loop/<id>?tab=Runs&run=<at>`; the tooltip shows the same text on hover *and* on keyboard focus (visible focus ring). Grid is a `table` with a caption for screen readers.

**Steer composer** (C4). Opens from a *Steer* button (outline, wheel icon) on the loop page header, each lane row and each unit, from the `S` key, and from the command palette. A dialog (section 11 dialog rules): *Scope* select (loop → lane; lane → unit, prefilled from where it was opened), *Timing* segmented control (Next run / Standing), one textarea ("Tell the lane what to do, in plain words"), then a read-only *Preview* box in mono showing the exact `steer.md` entry that will be written, from core's formatter (never re-implemented in web): heading `## 2026-10-13 14:05 UTC · <author> · next-run|standing`, where author is what the server reports (`git config user.name`) locally and an editable "Your name" field (default "owner") on the demo; a unit scope is written as the first line of the text ("Unit 4: …"), since the entry format has no unit field. The file path shown above the preview (`.ai/lanes/web/steer.md`). Buttons: local → *Save* and *Save and wake* (primary); demo → *Edit on GitHub* (opens the prefilled editor, says "GitHub opens on a page you still have to commit"). The lane page shows *Steer history*: newest first, each entry with its acknowledgement as a chip — "→ done in run 7" (tick), "→ not done: <why>" (warn), "waiting for the next run" (hollow).

**Schedule controls** (C5; each lane row and lane page). State sentence first, in words: "Due", "Sleeping since 14:00 UTC · 3 idle runs", "Snoozed until 18:00 UTC", "Paused by sam · reason". Then buttons: *Pause lane* / *Resume*, *Snooze until…* (a small time picker with 1 h / 3 h / tomorrow 09:00 presets), *Wake now*. Pause lane has the section 11 confirm step (it stops work); Snooze and Wake act at once locally (easy to undo, toast with Undo) and say what they wrote in the toast. Demo: every button is *Edit on GitHub* on the prefilled `schedule.json`. *Pause all* stays in the loop control bar.

**Releases list** (C7). Each version row: version (mono), date or "Unreleased", then chips: *Tagged* / *No tag*, npm *latest* / *published* / *not published* / *npm not checked* (grey), each chip icon + word; the row expands to its CHANGELOG entry (sections as plain lists, text only). A shipped version reads "0.4.0 released 13 Oct" on the card and in the strip's Ship segment. Ready to ship (section 11) shows only when not shipped.

**Next round with Draft with Claude** (C6; replaces the section 11 textarea-only Start next round). A dialog in three parts:
1. *Ingredients* (collapsible, open by default): the root/lane DONE "next 10" lists, open audit findings, unacknowledged steer entries and the brief's out-of-scope, each as a counted group ("Next-10 items · 23") with plain-text items; these are exactly what `loop next-round --draft` puts in its prompt.
2. *Brief* textarea (mono, 16 rows desktop / 10 phone) with the live brief score beside it ("Brief score 87 / 100", tick at or above the threshold, warn below with the first missing part named), updated as you type.
3. Buttons: local → *Draft with Claude* (secondary) streams `POST …/draft-brief` SSE progress into a status line ("Reading DONE files…") and the draft text into the box, with *Stop*; the box stays editable afterwards. Demo → *Copy prompt for Claude Code* (CommandBox copy rules; copies `--print-prompt` output) instead, since nothing can run there.
**Go** (primary, "Start round 6") is a separate, explicit click, disabled below the score threshold with the reason in text, and keeps the section 11 confirm step (what changes in the repo). Drafting never starts a round. Stream states: pending, streaming, done with score, failed with Retry, cancelled.

**Health three states** (A3). Each check row: *Pass* (tick, done colour) / *Fail* (cross, failing colour) / *Not checked* (grey dash, muted) with one sentence on how to check it ("Run `loop doctor` in the repo"). "OK" is never shown for an unmeasured check.

**Phone tab bars** (A6). The main nav and the loop tabs scroll sideways inside their row with a 24 px fade at the edge that has more content (no fade when at that end), labels never cut by the viewport edge without the fade, and the active tab is scrolled into view on load and on change (`scrollIntoView({inline:'nearest'})`, instant under reduced motion).

**Review checklist additions (17-22).**
17. From the home screenshot alone: anything need me, running or stalled, limit stops, CI, ready to ship — all five answered.
18. Banner, nav badge, strip and Inbox show the same number.
19. Every heat-map outcome has a word in the legend and a glyph in the cell.
20. Steer preview shows the exact file entry (core's formatter); the demo opens the exact GitHub URL.
20b. Next round: ingredients visible, Draft streams (or Copy prompt on the demo), live score, Go is its own click.
21. Schedule state reads as a sentence before any button.
22. At 375 px: strip on two lines, no clipped tab label without a fade, no horizontal page scroll.
