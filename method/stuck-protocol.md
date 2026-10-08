# Stuck protocol

Triggered by the same failure twice, or by two runs with no progress toward done-when. Do not retry a variant.

1. Stop. Record the attempt under Tried: what you did, the exact error, why it failed.
2. Search `.ai/index.md` for the error text.
3. Write down every assumption you are making. Move the ones you never tested to Guesses.
4. Test the weakest assumption with the cheapest experiment.
5. Try a structurally different approach, not a variant of what failed.
6. Still stuck, unattended: write `BLOCKED.md` (what you tried, the specific question, your best guess), commit, push and stop. With a human present: ask the same question.

Hard cap: a task that reaches about 5 runs without the checks passing goes to `BLOCKED.md`.
