You are running this repository's build loop by hand in a cloud session, in place of its hourly routine. Nobody is watching; the owner reads your final summary later.

Read CLAUDE.md and follow its "Unattended mode" section exactly, with one exception: ignore the 40-minute / 60%-context hand-off limit. Keep building units back to back for as long as this session lasts. IDEA.md is the brief.

1. Run `date -u`, then `git checkout main && git pull --ff-only`. Then claim the repo so the hourly routine stands down:
   - Write the current UTC time (`date -u +%Y-%m-%dT%H:%M:%SZ`) as the only line of `.ai/session.lock`, commit "Credit session: take the lock" and push it before anything else.
   - The routine skips its run while that time is less than 90 minutes old, so refresh it (rewrite the file with the current time) in every commit you push. When it goes stale, the routine resumes by itself.
2. If `BLOCKED.md` exists: if the answer is safe, easily reversible and follows from IDEA.md and CLAUDE.md, record it under Decisions in `.ai/task.md`, move the file to `.ai/blocked-<date>.md` and continue. If the answer needs the owner (money, accounts, a domain, legal or safety judgment), stop and report it.
3. If `DONE.md` exists, or a round has just finished, start the next round:
   - Stop instead if `.ai/done-v4.md` exists: that DONE.md ends round 5, so leave it in place.
   - Let K be the number of `.ai/done-v*.md` files plus 1. Move the finished round's DONE.md to `.ai/done-vK.md`.
   - Write a new `.ai/task.md` modelled on the previous round's task file (`git log -- .ai/task.md` shows where it was).
     - Title: "Build v(K+1) of the site: the 10 best next pages".
     - Set `Run: 0 / 30`.
     - The contract points at the "10 best next pages" list in `.ai/done-vK.md`.
   - Keep these rules in it:
     - Pages must earn their URL: merge or skip doorway or thin pages and record why.
     - Skip any page whose values can't be verified.
     - Never change a published URL.
     - Keep the google-site-verification tag.
   - Do the move and the new task.md in **one** commit, so `DONE.md` never sits on main between rounds.
4. Build units in order:
   - For each unit: `npm test`, then a reviewer subagent's sign-off.
   - Update the handoff in `.ai/task.md`, count each unit as one run on the `Run:` line, and refresh `.ai/session.lock`.
   - Then `git pull --rebase` and `git push origin main`.
   - When the round's work is finished, write DONE.md as CLAUDE.md says, then go straight back to step 3.
5. Stop when any of these happens:
   - round 5 is finished;
   - you are blocked on something that needs the owner;
   - the session is about to run out.
   Before you stop, `git rm .ai/session.lock`, commit and push, so the routine takes over at its next hour. End with a short summary: the round, the pages built this session, the sitemap count, and anything that needs the owner.

Never force-push or rewrite history. Never edit CLAUDE.md. Never spend money, sign up for anything, add keys, ads, analytics or tracking, or copy competitor content.
