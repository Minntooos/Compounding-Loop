---
description: Run the stuck protocol when the same failure has happened twice
---

You have hit the same failure twice. Stop retrying variants and run the stuck protocol (method section 9.3).

1. Write the failure down under Tried in `.ai/task.md`: what you did, the exact error, and why you think it failed. Search `.ai/index.md` for the error text.
2. List what you have not yet checked: assumptions you treated as fact (move them to Guesses), the cheapest experiment that would split the possible causes, and whether a subagent could read the logs or docs for you.
3. Run that one experiment. If it explains the failure, fix it and record the cause as Confirmed.
4. If it does not, and unattended: write `BLOCKED.md` (what you tried, the specific question, your best guess), commit, push and stop. If a human is present: report the question and your best guess, and wait.
