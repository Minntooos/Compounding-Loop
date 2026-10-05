# The Compounding Loop

*A universal method for working with AI agents. Built for coding first, but the same shape works for writing, research and analysis.*
*v1 · 2026-10-05*

> **How to read this file.** Part A (the Operating Card) is short and is meant to be loaded into every session: paste it into your always-loaded rules file (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.cursor/rules/`, …). Everything after it is reference. The AI reads a section only when that moment comes. The file follows its own rule: a small core that is always on, and everything else loaded on demand.

**Contents**

- Part A: Operating Card (always loaded)
- Part B: The method
  1. The objective
  2. Two ideas everything follows from
  3. The laws
  4. File layout
  5. The task contract
  6. Verification
  7. Memory
  8. Triggers
  9. The loop: handoff, resume, stuck
  10. The civilization: subagents and model tiers
  11. Self-prompting
  12. Finishing: retro, promotion ladder, cleanup
  13. Measurement
  14. The human's role
  15. Commands
- Part C: Templates
- Part D: Setup and adoption order
- Part E: Limits, open questions, where the ideas come from

---

## Part A: Operating Card

> Copy this section into your always-loaded rules file. Keep it under ~60 lines.
> The § numbers point to Part B of `COMPOUNDING_LOOP.md`.

**Objective:** the most verified-correct results per minute of the human's attention. Tokens are the cheapest resource. A wrong result that looks right is the most expensive one.

**Start of every session**
1. Read `.ai/index.md`. Open a knowledge entry only when it's relevant to what you're doing.
2. If `.ai/task.md` exists, run the resume protocol (§9.2) before anything else.

**Before work**
3. Size the task. Tiny: just do it. Medium: contract + checks. Large or unclear: plan, get approval, then loop.
4. For medium and large tasks, write the contract (§5): goal, done-when (checkable by a command), constraints, out of scope. Ask all clarifying questions at once, before starting.

**During work**
5. One unit of work at a time. Run the checks after each unit. You never declare done; the checks do.
6. Write a note the moment you learn something, marked CONFIRMED or GUESS. Don't save it for the end.
7. After any error, search `.ai/index.md` for the error text before trying a fix.
8. Before editing a file, check the index for entries about that path.
9. Send reading-heavy work (search, docs, logs, review) to subagents that report back in 10 lines or fewer. Keep code-writing in one thread.
10. Same failure twice: stop and run the stuck protocol (§9.3). Don't retry a variant.
11. If reality contradicts the plan or contract, stop and report. Don't silently work around it.
12. Point to code and docs (`path:line`). Never copy them into notes.

**Context**
13. At ~50–60% context, or when a unit is done and the next one is big: run the handoff (§9.1), then tell the human the next window is ready.

**Finishing**
14. When the checks pass, run the retro (§12): propose promotions, flag stale entries, log the task, and delete `.ai/task.md` after approval.

**Never**
- Mark your own work done without the checks passing.
- Treat a GUESS from an earlier window as fact.
- Delete or rewrite CONFIRMED knowledge without new evidence.
- Change this card without the human's approval.

---

## Part B: The method

### 1. The objective

Ranked by real cost, most expensive first:

1. **Wrong results that look right.** You find out late, and everything built on top has to be redone.
2. **Human attention.** Explaining, re-explaining, watching, reviewing.
3. **Waiting time.**
4. **Tokens and money.** The cheapest by far, and context that stays the same between calls is cached at a reduced rate.

So the goal is **the most verified-correct results per minute of human attention.**

Trim context when it hurts quality (noise, stale notes, contradictions), not to save tokens. Compressing a note into keywords saves a few hundred tokens out of a session that uses 50–150k, and throws away the *why*, which is the part that prevents repeated mistakes. That's a net loss.

### 2. Two ideas everything follows from

**Compounding.** Most methods make one task efficient. This one is built so that every task makes the next one cheaper. Every mistake gets fixed twice: once in the code, and once in the system (a note, a trigger, or best of all an automated check), so it can't happen again.

**Sparse activation.** Wake only what the moment needs. Large AI models already work this way inside: in a mixture-of-experts model, only a few expert sub-networks run for each token. This method applies the same principle at every level:

| Level | Dense (wasteful) | Sparse (this method) |
|---|---|---|
| Memory | Load every rule every session | A short index, plus triggers that fire at the moment of relevance (§7, §8) |
| Context | One long window that slowly degrades | Fresh windows with handoffs; subagents for reading (§9, §10) |
| Compute | The strongest model for everything | The cheapest tier that passes the checks (§10) |
| Rules | Prose rules re-read forever | Automated checks that cost nothing until broken (§12) |
| Human attention | Watching the agent work | Four touchpoints (§14) |

### 3. The laws

1. **Nothing is done until a check says so.**
2. **Every window gets the context its task needs: no more, no less.**
3. **Confirmed and guessed are always labeled.** A guess from a confused window that a fresh window reads as fact is the most common way loops go wrong.
4. **Point to the truth; never copy it.** Copies go stale. The code doesn't.
5. **Keep knowledge as low on the ladder as it can go:** automated check > trigger > note > always-loaded rule.
6. **Write notes when you learn, not when you're tired.** The end of a long session is the worst moment to summarize.
7. **Same failure twice means change strategy, not retry.**
8. **Many readers, one writer.** Read in parallel. Write in one thread, unless the files don't overlap.
9. **Spend intelligence on the spec, save it on execution.** The better the instructions, the smaller the model that can carry them out.
10. **Measure, or you're guessing.**

### 4. File layout

```
CLAUDE.md / AGENTS.md / GEMINI.md   ← Operating Card + project core (≤ ~150 lines total)
.ai/
  index.md        ← one line per knowledge entry (always loaded)
  knowledge/      ← one entry per file (loaded on demand or by a trigger)
  triggers.yaml   ← machine-readable triggers, for tools with hooks
  task.md         ← the current task's handoff (exists only during a task)
  plans/          ← plans for large, multi-window tasks
  routing.md      ← task type → model tier, with track record
  log.md          ← one line per finished task
~/.ai/libs/       ← cross-project knowledge, one file per library@major-version
```

The **project core** sits next to the card in the rules file. It holds only:
- what the project is (2–3 lines)
- exact commands to install, run, test and build
- the handful of hard rules that apply to every task
- where things live

Everything else goes in `.ai/knowledge/`.

### 5. The task contract

Before any medium or large task, write:

- **Goal.** One sentence about the outcome, not the activity.
- **Done when.** Checks a script can run: tests pass, build succeeds, a command exits 0, a screenshot matches. If you can't write one, the task isn't understood yet: ask, or explore first.
- **Constraints.** What must not change, and what must be reused.
- **Out of scope.** What not to touch, even if it's tempting.
- **Questions.** All of them, in one batch, before starting. A question costs seconds. A wrong assumption costs a whole window.

For large tasks, write a plan in `.ai/plans/` where every step has its own done-when, and get approval before building. Changing a plan is cheap. Changing code isn't.

### 6. Verification

This is the biggest multiplier in the whole method. An agent that can check its own work can loop alone. One that can't turns the human into the checker.

- **Build checks before features.** Types, lint, tests, build, end-to-end or screenshot checks, a script that exits 0. Types are the cheapest check and also the cheapest documentation.
- **Keep checks fast.** A 10-second suite gets run 20 times. A 10-minute one gets skipped. Keep a fast subset for each unit and run the full suite at the end.
- **Write the test that proves done-when before writing the code.**
- **The writer never reviews itself.** Final review comes from a fresh window that didn't write the code, with an adversarial brief: *"Find the three most likely ways this is wrong, and check each one."*
- **Error messages are prompts.** When you write a custom check, make its failure message say how to fix the problem. The agent reads it at exactly the right moment.
- **Beyond code.** For writing, research or analysis, the checker is a rubric written in advance, plus a critic in a fresh window, plus checking claims against sources.

### 7. Memory

Five layers, each loaded differently:

| Layer | Holds | Loaded |
|---|---|---|
| Core | Operating Card + project core | Always. Small and unchanging, so it stays cached |
| Index | One line per knowledge entry | Always |
| Knowledge | Gotchas, facts, decisions, lessons, open questions | Only when relevant or triggered |
| Task state | `.ai/task.md` | Every window of the current task; deleted afterwards |
| Source of truth | Code, git history, test output, docs | Read when needed; never copied |

**Every knowledge entry has** a type, a status (CONFIRMED or GUESS), triggers, evidence, and two counters (times it fired, times it helped). The template is in Part C.

**Index lines are for routing, not content.** They carry just enough words to decide "do I need to open this?" and nothing more:

```
K-0017 gotcha ✔ MV3 service worker loses in-memory state after ~30s idle · files: src/background/**
```

**Cross-project knowledge is keyed by library and major version, not by project type.** At task start, read the dependency manifest (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, …) and load the index lines from `~/.ai/libs/<library>@<major>.md` for each dependency. This has three advantages:
- No guessing about what "kind" of project this is.
- It combines on its own: a Next + Supabase + Tailwind project simply gets all three sets of notes.
- Notes expire when the major version changes, which is exactly when they tend to become wrong.

### 8. Triggers

Loading every rule at session start has a hidden flaw. By the time a rule matters, it's buried far back under everything since. A note that appears right next to the action is much harder to miss.

Triggers watch events the tool already sees, run outside the model, and cost nothing until they fire. Four kinds, most precise first:

| Trigger | Fires when | Example |
|---|---|---|
| **Error** | Command output matches a known error | `fetch is not a function` → "Node 16 has no built-in fetch; this project needs Node 18 (K-0042)" |
| **File** | The agent reads or edits a matching path | Editing `src/background/**` → the MV3 lifecycle note |
| **Command** | Before a matching command runs | `npm run build` → "run `npx prisma generate` first" (or just run it automatically) |
| **Topic** | The task text matches keywords | "persist auth" → a one-line hint pointing to K-0017 |

- **With hooks** (for example Claude Code): a small script matches each event against `.ai/triggers.yaml` and injects the entry. Error and file triggers run after tool calls; command triggers run before.
- **Without hooks:** manual trigger mode. Card rules 7 and 8 make the agent search the index after errors and before edits. It's less automatic but has the same effect, and works in any tool.
- **Precision beats coverage.** A trigger that fires often and doesn't help is noise. Track `fired` and `helped`, and fix or delete triggers that help less than about half the time.

### 9. The loop

One task takes one or more windows. In each window:

1. Start fresh. Load the core, the index and `task.md`.
2. Do one unit of work.
3. Run the checks.
4. Green: commit. Red: log the attempt with the reason, and revert.
5. Repeat until the window is ~50–60% full or the unit is done.
6. Hand off.

#### 9.1 Handoff protocol

The goal: a fresh window with zero memory of this one can continue at full quality.

1. Run the checks and record the actual results, not remembered ones.
2. Commit green work. Revert or stash red work, and say so. The next window must start from a known state.
3. Rewrite **Current state**: branch, commit, check status, the single next step, and what to read first.
4. Add to **Tried**: approach → result → *why* it failed. One line each. Never delete from Tried during a task.
5. Sort new knowledge into **Confirmed** (with how you know) and **Guesses** (with how to test them). Mark anything that applies beyond this task with `promote?` for the retro.
6. **Stranger test.** Reread the file as someone who knows nothing about this session. Could they continue without asking anything? Fix whatever fails.
7. Keep it to about one page. If it's longer, move the details into knowledge entries and link to them.
8. Tell the human three things: the file is ready, what you chose to leave out, and the next step.

#### 9.2 Resume protocol

1. Read the core, the index and `.ai/task.md`.
2. **Verify before trusting.** Compare Current state with reality (git status, git log, run the checks). Reality wins: if they disagree, fix the file and say so.
3. Treat Guesses as ideas to test, never as facts.
4. State the next step in one line, then do it.

#### 9.3 Stuck protocol

Triggered by the same failure twice, or by two windows with no progress toward done-when.

1. Stop. Write down every assumption you're making.
2. Test the weakest assumption with the cheapest possible experiment.
3. Try a structurally different approach, not a variant of what failed.
4. Fan out: run 2–3 independent attempts in separate git worktrees and keep the one that passes the checks.
5. Move up one model tier or effort level (§10).
6. Ask the human, with what was tried, the specific question, and your best guess.

**Hard cap:** if a task reaches about 5 windows without the checks passing, stop and review it with the human. Loops left alone go in circles.

### 10. The civilization: subagents and model tiers

Picture a society of specialists, each woken only when needed. The specialists are made with **context, not training**: a specialist is a general model plus a role brief, its triggered knowledge, and the tools and files it's allowed to use. Context is cheap to create. Trained models aren't.

**The tiers:**

| Tier | Who | Use for |
|---|---|---|
| 0 | Tools, not models: compiler, type checker, linter, tests, grep, formatter, scripts | Anything a tool can do exactly. Free, and never wrong within its domain. Always try this first |
| 1 | Small, fast model, low effort | Finding code, summarizing files and logs, extracting, classifying, mechanical edits from an exact spec, running checks and reporting |
| 2 | Mid-size model, medium effort | Implementing a fully specified unit; writing tests from a spec |
| 3 | Strongest model, high effort | Planning, splitting work, writing contracts, debugging unknown failures, architecture, final review, retro decisions |

**A task is safe for a lower tier only if both hold:**
- it's fully specified, with no judgment calls left
- a check can tell whether it worked

Without a check, never move a task down a tier. Cheap results that are wrong but look right are the most expensive outcome there is.

**Move up a tier instead of retrying.** A failed check moves the task one tier up. Trying the cheap tier first and moving up on failure is usually far cheaper than always using the top tier, but only if failures get caught.

**Routing learns from the log** (`.ai/routing.md`):
- New task types start at tier 3.
- Move a type down one tier after about 90% first-try passes over its last 10 tasks.
- Move it back up after 2 failures in its last 5.

**Roles:**
- **Orchestrator** (tier 3): owns the plan, writes the workers' contracts, reads their short reports, and makes the decisions. It doesn't read whole files itself.
- **Workers** (tier from the routing table): each gets only its contract and triggered notes, in a fresh window. It writes results to files and reports back where they are, plus 3 lines at most.
- **Checker** (tier 0): runs after every worker.
- **Reviewer** (tier 3, fresh window): reads the final diff before merge, and wrote none of it.

**Rules for splitting:**
- Split where a big input turns into a small output: search, docs, research, review, test runs. Don't split by job title. A frontend agent, backend agent and QA agent copy an org chart, and every handoff between them loses information.
- Many readers, one writer. Workers write in parallel only when their file lists don't overlap, each in its own worktree.
- Workers report surprises instead of improvising. All decisions stay with the orchestrator, so parallel workers never make conflicting hidden choices.
- Don't split small tasks (coordinating costs more than the work), tightly connected features (use one writer plus read-only helpers), or problems nobody understands yet (one agent explores first).
- Shared state lives in files (plan, `task.md`, knowledge), never only in messages between agents.

### 11. Self-prompting

The AI writes prompts for its next window, its subagents and its reviewers. It's the best author of those prompts, because it knows what it learned. It's also the worst judge of what it forgot to say. These rules close that gap:

1. **Write for a stranger.** The reader has none of your context. Test it: could they act correctly with only this text and the repo?
2. **Turn "quality" into checks.** "Best quality possible" is a wish. Translate it: what would make this fail review? Make those things the done-when.
3. **Give the why with every instruction.** Reasons carry over to cases the instruction didn't mention. Bare rules don't.
4. **Say what not to do:** the Tried list and the known traps.
5. **Mark what's uncertain** as a guess, along with how to test it.
6. **Point, don't paste.** Give paths, commands and `path:line`, not file contents.
7. **Give an exit.** Say what to do if the instructions don't match reality: stop and report.
8. **Set the output shape:** where to write, how long, and what to return.
9. **Every line must change what the reader does.** Cut the rest.

**What the AI can write for itself.** The sky really is the limit here, as long as the checks and approvals stay in place:
- the next window's prompt (the handoff)
- contracts for its subagents
- the checks (tests and scripts), before the code
- an adversarial brief for its reviewer, and a pre-mortem: *"Assume this shipped and broke. What's the most likely reason?"*
- triggers and knowledge entries for what it discovered
- proposed changes to its own rules, the card and the routing table

**Limits on self-modification.** The AI edits `task.md`, guesses and its own notes freely. Changes to the card, the project core, CONFIRMED knowledge and the routing thresholds are proposals that the human approves.

### 12. Finishing: retro, promotion ladder, cleanup

**Retro.** About 2 minutes, when the checks pass. The AI drafts it and the human approves.
1. List what was learned. For each item: does it apply beyond this task, or only to it? Is it confirmed or a guess? At what moment would it have helped (which file, command or error)?
2. Move general, confirmed items down the promotion ladder as far as they'll go.
3. Put library-level lessons in `~/.ai/libs/<library>@<major>.md`.
4. Delete `.ai/task.md`. Knowledge that only mattered for this task goes with it, on purpose.
5. Add a line to `.ai/log.md` (§13) and update `routing.md`.

**The promotion ladder:**

```
guess → confirmed note → note with a trigger → automated check
```

The last step is the goal: **the best memory is one the model never has to read.** "Never use `require()` here" becomes a lint rule. "Run prisma generate before build" becomes part of the build script. Then the prose note is deleted. A check costs nothing until it's broken, and it can't be ignored.

**Cleanup.** Every ~10 tasks, or when the human says "clean up memory":
- Archive entries that haven't fired in ~20 tasks.
- Fix or delete entries that fired and misled.
- Expire library notes when the library's major version changes.
- Merge duplicates. Resolve contradictions: newer evidence wins.
- Check that every `path:line` pointer still exists.
- Keep the card and project core under ~150 lines.

### 13. Measurement

Add one line per finished task to `.ai/log.md`:

```
2026-10-05 | add retry to fetchUser | M | human 6m | 2 windows | first-try ✔ | tier-ups 0 | $0.40 | repeat errors 0 | triggers 3 fired / 2 helped
```

What to watch:
- **Human minutes per task.** The main number.
- **Repeat-error rate:** errors that were already in your knowledge. This is the system's report card and should trend toward zero.
- **First-try pass rate per tier.** This feeds the routing table.
- **Trigger precision:** times helped ÷ times fired.
- **Windows until the checks pass**, and cost.

Prefer numbers from tools (check results, git, billing) over the AI's own account of how things went. Change one thing at a time and watch the numbers. Every threshold in this file (50–60%, 20 tasks, 90%, 5 windows) is a starting guess for your log to correct.

### 14. The human's role

Your attention goes to four places only:

1. **The contract:** intent and done-when.
2. **The plan:** for large tasks.
3. **The result:** the final diff and the check results.
4. **The retro:** approving what gets promoted.

Everything in between runs without you, ideally in the background or as several independent tasks running side by side. If you catch yourself watching the agent work, something earlier is missing, usually a check.

### 15. Commands

Say it any way you like. The AI maps it to the right protocol.

| You say | The AI does |
|---|---|
| "New task: …" / "let's build …" | Contract (§5): restates the task, asks all questions at once, proposes done-when, sizes the task |
| "Plan it" | Orchestrator mode: writes a plan in `.ai/plans/` with steps and contracts, then waits for approval |
| "Update the context so we continue in a new window" / "handoff" | Handoff protocol (§9.1) |
| "Continue" / "resume" (in a new window) | Resume protocol (§9.2) |
| "This isn't working" / "we're stuck" | Stuck protocol (§9.3) |
| "Done" / "wrap up" | Checks → retro → promotions → log → delete `task.md` (§12) |
| "Clean up memory" | Cleanup (§12) |
| "How are we doing?" | A summary of the trends in `.ai/log.md` |

**The full-strength version of your usual handoff line:**

> Handoff: update `.ai/task.md` so a fresh window with zero memory of this one can continue at full quality. Run the checks first and record the real results. Commit or revert so the code is in a known state. Rewrite Current state, add to Tried with the *why*, keep Confirmed and Guesses separate, and end with the single next step and what to read first. Then tell me what you left out.

**And for the new window:**

> Resume from `.ai/task.md`. Verify Current state against git and the checks before trusting it, tell me about any mismatch, then do the next step.

---

## Part C: Templates

### C.1 `.ai/task.md`

```markdown
# TASK: <name>  (window 3)

## Contract
Goal: <one sentence, outcome>
Done when: `<command>` passes; <other checks>
Constraints: <what must not change / must be reused>
Out of scope: <what not to touch>

## Current state  (rewrite every window)
- Branch / commit: feat/<x> @ <hash>, clean
- Checks: 41 pass, 2 fail (<names>)
- Next step: <exactly one step>
- Read first: <path:lines>, <K-ids>

## Confirmed  (with how we know)
- <fact> (seen in <test / log / commit>)

## Guesses  (test before building on them)
- <hypothesis> (test: <cheapest experiment>)

## Tried  (append-only: approach → result → why)
1. <approach> → <result> → <why it failed>

## Don't
- <thing not to retry> (Tried #<n>)

## promote?  (for the retro)
- <general lesson worth keeping>
```

### C.2 Worker contract

```markdown
## Task: <one line>
Tier: 2 · Effort: medium
Files you may edit: <exact paths>
Read first: <paths, K-ids>
Done when: <command> passes, including <new test name>
Constraints: <reuse X; don't change Y's signature>
Known traps: <K-ids, Tried #n from task.md>
If anything doesn't match this contract: stop and report. Don't work around it.
Report (3 lines max): what changed, check results, any surprise.
```

### C.3 Knowledge entry (`.ai/knowledge/K-0017.md`)

```markdown
---
id: K-0017
type: gotcha            # fact | gotcha | decision | lesson | question
status: confirmed       # confirmed | guess
scope: project          # or lib:<library>@<major>
triggers:
  files: ["src/background/**"]
  errors: []
  commands: []
  topics: [service worker, background state, persistence]
evidence: <how we know: test, log, commit hash>
created: 2026-10-05
fired: 0
helped: 0
---
MV3 service workers are stopped after ~30s idle, so anything held only in memory is lost.
Keep state in chrome.storage.local. See src/background/state.ts:10.
```

### C.4 `.ai/index.md`

```markdown
K-0017 gotcha   ✔ MV3 service worker loses in-memory state after ~30s idle · files: src/background/**
K-0031 gotcha   ✔ build fails silently without prisma generate · cmd: npm run build
K-0042 fact     ✔ native fetch needs Node 18+ · err: fetch is not a function
K-0050 question ? why does auth drop after laptop sleep? · topics: auth, session
```

### C.5 `.ai/triggers.yaml`

```yaml
- id: K-0042
  on: error
  match: "fetch is not a function"
  inject: .ai/knowledge/K-0042.md
- id: K-0017
  on: file
  match: "src/background/**"
  inject: .ai/knowledge/K-0017.md
- id: K-0031
  on: command
  match: "npm run build"
  inject: "Run `npx prisma generate` first; the build fails silently without it. (K-0031)"
```

### C.6 `.ai/routing.md`

```markdown
| Task type                  | Tier | Effort | Last 10 first-try | Notes                    |
|----------------------------|------|--------|-------------------|--------------------------|
| find code / locate usages  | 1    | low    | 10/10             |                          |
| summarize logs             | 1    | low    | 9/10              |                          |
| write tests from a spec    | 2    | medium | 9/10              |                          |
| implement specified unit   | 2    | medium | 8/10              | 2 more fails → tier 3    |
| debug unknown failure      | 3    | high   | —                 | never moves down         |
| plan / contracts / review  | 3    | high   | —                 | never moves down         |
```

### C.7 Retro

```markdown
## Retro: <task>
Learned:
- [general | task-only] [confirmed | guess] <item> (would have helped at: <file / command / error>)
Promote:
- <item> → <note | trigger | check (what kind)>
Fix / delete:
- <K-id> (<why>)
Routing changes:
- <task type> → tier <n> (<reason>)
Log line:
<date> | <task> | <size> | human <m> | <windows> | ...
```

---

## Part D: Setup and adoption order

### Where each piece lives, per tool

| Piece | Claude Code | Other tools |
|---|---|---|
| Always-loaded rules (card + core) | `CLAUDE.md` | `AGENTS.md` (Codex and many others), `GEMINI.md` or `.agent/rules/` (Antigravity), `.cursor/rules/` (Cursor) |
| Triggers | Hooks: after tool calls for error and file triggers, before tool calls for command triggers | Cursor's glob-scoped rules work as file triggers. Everywhere else: manual trigger mode (card rules 7 and 8) |
| Model tiers | `.claude/agents/*.md`, with model, effort and tools set per agent | Wherever your tool lets you pick a model per agent or per chat. Otherwise, run separate chats by hand |
| Fresh windows | `/clear`, or `claude -p` in a script loop | New chat or session |

### Adoption order

Don't set up everything at once. Each step is useful by itself:

1. **Card + `task.md` + the handoff and resume lines.** This is what you already do, sharpened.
2. **Contracts with done-when, and checks.** The biggest single gain.
3. **`log.md`.** Start measuring early, so you can tell whether the next steps help.
4. **Index, knowledge entries and the retro.** Memory starts compounding.
5. **Triggers through hooks.** Repeat errors start disappearing.
6. **Tiers and routing.** Cost drops once the log shows which tasks are safe to move down.
7. **Cross-project library memory.** New projects start ahead.

---

## Part E: Limits, open questions, where the ideas come from

**Limits and open questions**
- **Every number here is a starting guess.** Your log decides the real thresholds.
- **Overhead.** Ceremony that's too heavy for the task wastes time. Always size the task first.
- **Trigger noise.** Without pruning, triggers turn into the clutter they were meant to prevent.
- **Models change.** Bigger reliable context windows shift when to hand off. Stronger small models shift routing. The principles stay the same while the numbers move, so recheck routing whenever you switch models.
- **Self-reporting is biased.** An agent's account of its own success is the weakest evidence. Tool output is the strongest.
- **Unproven as a whole.** Individual pieces have evidence behind them. The combination is a hypothesis, and your log is the test.

**Where the ideas come from**
- **Retry with written reflections:** Reflexion (Shinn et al., 2023).
- **Fresh-context loops with state in files:** the "Ralph" loop (Geoffrey Huntley), and Anthropic's work on harnesses for long-running agents.
- **Orchestrator plus parallel workers, and their cost tradeoff:** Anthropic's multi-agent research system.
- **Short map pointing into a docs folder, plans kept in the repo, lint errors that teach the fix, background cleanup agents:** OpenAI's "harness engineering".
- **Hidden-decision conflicts between parallel agents:** Cognition (the Devin team).
- **Sparse activation:** mixture-of-experts models (Google's sparsely-gated MoE, Switch Transformer, GLaM).
- **Cheap-model-first cascades and routers:** FrugalGPT and RouteLLM.
- **A civilization of simple specialists:** Marvin Minsky, *The Society of Mind* (1986).
- **New in this combination, as far as I know:** error-message triggers, the promotion ladder ending in automated checks, cross-project memory keyed by library and version, confirmed/guess labels with cleanup based on how often entries fire, routing learned from your own log, and the repeat-error rate as the core metric.
