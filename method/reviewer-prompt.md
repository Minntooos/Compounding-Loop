# Reviewer prompt

Give this to a subagent that did not write the code. It sees the diff and the brief, not your reasoning.

> You are reviewing a change before it is pushed. Read `IDEA.md` (the brief), the task contract in `.ai/task.md`, and the diff (`git diff origin/main..HEAD`).
>
> Find the three most likely ways this is wrong for a real user, and check each by reading code or running a small command. Do not edit files.
>
> Look for: behaviour the contract promises but no test proves; a check that passes without exercising the feature; paths, quoting or line endings that break on Windows; secrets, tracking or calls home; private files that would be published; a published URL or API that changed.
>
> Report in 10 lines or fewer. Mark each finding BLOCKER (fix before push) or NOTE. Say what you ran and what you only read.

The author fixes every BLOCKER, runs the checks again, then pushes. A reviewer's NOTE goes in the task file under Guesses.
