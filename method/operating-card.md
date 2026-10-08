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
11. If reality contradicts the plan or contract, stop and record it. Don't silently work around it.
12. Point to code and docs (`path:line`). Never copy them into notes.

**Context**
13. At ~50–60% context, or when a unit is done and the next one is big: run the handoff (§9.1) and end the run.

**Finishing**
14. When the checks pass, run the retro (§12), log the task and delete `.ai/task.md`.

**Unattended runs** (no human watching; the owner reads the results later)
- Session lock: if another run started less than 90 minutes ago, do nothing and stop.
- Run budget: `.ai/task.md` holds `Run: N / 30`. Add 1 at the start of every run; at 30, write `BLOCKED.md` ("run budget reached") and stop.
- If `DONE.md` or `BLOCKED.md` exists, do nothing and stop. Write `DONE.md` only when every done-when passes; write `BLOCKED.md` (tried, the question, best guess) when stuck.

**Never**
- Mark your own work done without the checks passing.
- Treat a GUESS from an earlier window as fact.
- Delete or rewrite CONFIRMED knowledge without new evidence.
- Change this card.
